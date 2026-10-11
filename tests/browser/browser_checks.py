"""
Frontend checks in real headless Chromium (Playwright for Python).

IMPORTANT: the backend is MOCKED here (requests to the API are intercepted and
answered by this script) and external CDNs are blocked. These checks prove how
the PAGES behave, not that the live Render service, database, email or payment
provider work.

Run from the repo root:   python3 tests/browser/browser_checks.py
"""
import json, os, re, subprocess, sys, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = 0  # let the OS pick a free port
BASE = None
API = re.compile(r'https?://(127\.0\.0\.1|localhost):5500/.*')
USER = {'id': 'u1', 'username': 'tester', 'firstname': 'Test', 'lastname': 'User', 'email': 't@t.co', 'plan': 'Free', 'role': 'USER', 'dob': '1995-05-05', 'tutorialStatus': 'completed', 'conditions': [], 'allergies': []}
PAGES = ['index.html', 'Login_page.html', 'register.html', 'Forget_Password.html', 'doctor-login.html', 'privacy.html', 'terms.html', 'dashboard.html', 'admin.html']
results = []
def check(name, ok, detail=''):
    results.append((ok, name, detail)); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail and not ok else ''))

# ---------- static source checks ----------
def read(p): return open(os.path.join(ROOT, p), encoding='utf8').read()
html_files = [f for f in os.listdir(ROOT) if f.endswith('.html')]
check('no HIPAA claim on any page', not any(re.search('hipaa', read(f), re.I) for f in html_files if f not in ('privacy.html', 'terms.html')) and 'HIPAA' not in read('privacy.html') + read('terms.html'))
for f in ('admin.html', 'Login_page.html'):
    src = read(f)
    check(f'{f}: no hard-coded admin username/password', not re.search(r"ADMIN_(CREDS|PASSWORD|USERNAME)|medai_admin_creds|Your-momma", src))

# ---------- mock backend ----------
state = {'dob_required': False, 'dob_complete': (200, {'user': USER}), 'dob_posts': [], 'admin_users': [], 'admin_me': 200, 'complete': (201, {'token': 'tok', 'user': USER}), 'convo': (200, {'conversation': {'id': 'c1'}})}
def mock(route):
    r = route.request; u = r.url
    h = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'}
    if r.method == 'OPTIONS': return route.fulfill(status=204, headers=h)
    def ok(b, s=200): route.fulfill(status=s, headers=h, content_type='application/json', body=json.dumps(b))
    if '/api/admin/me' in u:
        return ok({'admin': {'id': 'a', 'username': 'boss'}}) if state['admin_me'] == 200 else ok({'message': 'x'}, state['admin_me'])
    if '/api/admin/users' in u: return ok({'users': state['admin_users'], 'total': len(state['admin_users']), 'page': 1, 'pageSize': 50, 'totalPages': 1})
    if '/api/admin/' in u: return ok({'users': [], 'records': [], 'total': 0})
    if '/api/auth/complete-dob' in u:
        state['dob_posts'].append(r.post_data); st, body = state['dob_complete']
        if st == 200: state['dob_required'] = False
        return ok(body, st)
    if state['dob_required'] and '/api/' in u and r.method != 'POST': return ok({'code': 'DOB_REQUIRED', 'message': 'Please enter your date of birth to continue.'}, 403)
    if '/api/auth/login' in u: return ok({'token': 'LOGIN_TOKEN', 'user': USER})
    if '/api/auth/google/complete' in u: return ok(state['complete'][1], state['complete'][0])
    if '/api/ai/usage' in u: return ok({'used': 3, 'limit': 10, 'isPremium': False})
    if '/api/doctor-portal/conversations' in u and r.method == 'POST': return ok(state['convo'][1], state['convo'][0])
    if '/api/profile' in u or '/api/auth/me' in u: return ok({'user': USER})
    return ok({})

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=ROOT))
BASE = f'http://localhost:{httpd.server_address[1]}/'
threading.Thread(target=httpd.serve_forever, daemon=True).start()

def ctx_for(b, **kw):
    c = b.new_context(**kw); c.route(API, mock)
    c.route(re.compile(r'https?://(?!localhost|127\.0\.0\.1).*'), lambda r: r.abort())
    return c

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # ---------- admin gate ----------
    def admin_page(token=None, session_flag=False, me=200):
        state['admin_me'] = me
        c = ctx_for(b, viewport={'width': 1280, 'height': 800}); pg = c.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        scripts = []
        if token: scripts.append("localStorage.setItem('medai_token','tok')")
        if session_flag: scripts.append("sessionStorage.setItem('medai_admin_session','active')")
        if scripts: pg.add_init_script(';'.join(scripts))
        pg.goto(BASE + 'admin.html'); pg.wait_for_timeout(1200)
        vis = lambda sel: pg.evaluate(f"(()=>{{const e=document.querySelector('{sel}');return !!e && getComputedStyle(e).display!=='none'}})()")
        out = dict(gate=vis('#login-screen'), shell=vis('#admin-shell'), msg=pg.inner_text('#admin-gate-msg'), pw_inputs=pg.locator('#login-screen input[type=password]').count(), errs=errs)
        c.close(); return out
    a = admin_page()
    check('admin.html with no session: gate shown, shell hidden', a['gate'] and not a['shell'])
    check('admin.html has NO password field to type a credential into', a['pw_inputs'] == 0)
    a = admin_page(token=True, session_flag=True, me=403)
    check('forging the old sessionStorage flag does NOT unlock admin; server 403 → "no administrator access"', not a['shell'] and 'administrator' in a['msg'].lower(), a['msg'])
    a = admin_page(token=True, me=401)
    check('expired/invalid token → asked to sign in again', not a['shell'] and 'expired' in a['msg'].lower(), a['msg'])
    a = admin_page(token=True, me=200)
    check('server-verified admin sees the admin shell with no JS errors', a['shell'] and not a['gate'] and not a['errs'], str(a['errs'][:2]))

    # ---------- Google date-of-birth step ----------
    def login_with_hash(hash_, complete):
        state['complete'] = complete
        c = ctx_for(b, viewport={'width': 390, 'height': 844}); pg = c.new_page()
        pg.goto(BASE + 'Login_page.html' + hash_); pg.wait_for_timeout(1000)
        return c, pg
    c, pg = login_with_hash('#google_signup=FAKESTEPTOKEN', (400, {'message': 'You must be at least 18 years old to use MedAI.'}))
    check('Google sign-up lands on a date-of-birth step', pg.locator('#google-dob-modal').count() == 1)
    check('step token is removed from the URL after reading it', 'google_signup' not in pg.url and 'FAKESTEPTOKEN' not in pg.url)
    pg.fill('#google-dob-input', '2012-01-01'); pg.click('#google-dob-submit'); pg.wait_for_timeout(600)
    err = pg.inner_text('#google-dob-error')
    check('under-18 answer from the server is shown and the modal stays', 'at least 18' in err and pg.locator('#google-dob-modal').count() == 1, err)
    pg.click('#google-dob-submit'); pg.fill('#google-dob-input', ''); pg.click('#google-dob-submit'); pg.wait_for_timeout(300)
    check('empty date is refused client-side', 'date of birth' in pg.inner_text('#google-dob-error').lower())
    token_before = pg.evaluate("localStorage.getItem('medai_token')")
    check('no session was stored by a failed under-18 attempt', token_before is None)
    c.close()
    c, pg = login_with_hash('#google_signup=FAKESTEPTOKEN', (201, {'token': 'tok', 'user': USER}))
    pg.fill('#google-dob-input', '1990-01-01'); pg.click('#google-dob-submit'); pg.wait_for_timeout(1500)
    check('adult answer completes sign-in (session token stored)', pg.evaluate("localStorage.getItem('medai_token')") == 'tok', pg.url)
    c.close()
    c, pg = login_with_hash('#google_dob=FAKESTEPTOKEN', (200, {'token': 'tok', 'user': USER}))
    check('existing-account DOB step also shows the modal', pg.locator('#google-dob-modal').count() == 1)
    c.close()


    # ---------- dashboard: legacy session without a date of birth (server answers 403 DOB_REQUIRED) ----------
    state['dob_required'] = True; state['dob_posts'].clear(); state['dob_complete'] = (400, {'message': 'You must be at least 18 years old to use MedAI.'})
    c = ctx_for(b, viewport={'width': 1280, 'height': 800}); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('medai_token','tok');localStorage.setItem('medai_current_user', JSON.stringify(%s))" % json.dumps(USER))
    pg.goto(BASE + 'dashboard.html'); pg.wait_for_timeout(1800)
    check('DOB_REQUIRED from the server shows a blocking date-of-birth prompt', pg.locator('#dob-required-modal').count() == 1)
    pg.fill('#dob-required-input', '2015-01-01'); pg.click('#dob-required-submit'); pg.wait_for_timeout(600)
    check('under-18 answer: server message shown, prompt stays, request carried only the date', 'at least 18' in pg.inner_text('#dob-required-error') and pg.locator('#dob-required-modal').count() == 1 and len(state['dob_posts']) == 1 and json.loads(state['dob_posts'][0]) == {'dob': '2015-01-01'}, str(state['dob_posts']))
    state['dob_complete'] = (200, {'user': USER})
    pg.fill('#dob-required-input', '1990-01-01')
    with pg.expect_navigation(timeout=5000): pg.click('#dob-required-submit')
    pg.wait_for_timeout(1500)
    check('adult answer completes it and the dashboard reloads without the prompt', pg.locator('#dob-required-modal').count() == 0 and not errs, str(errs[:2]))
    c.close(); state['dob_required'] = False

    # ---------- admin: expired Premium is not shown as Premium ----------
    state['admin_users'] = [
        {'id': 'a1', 'username': 'activeUser', 'email': 'a@x.co', 'plan': 'Premium', 'premiumStatus': 'active', 'premiumExpiresAt': '2099-01-01T00:00:00Z', 'role': 'USER', 'conditions': [], 'allergies': []},
        {'id': 'e1', 'username': 'expiredUser', 'email': 'e@x.co', 'plan': 'Free', 'storedPlan': 'Premium', 'premiumStatus': 'expired', 'premiumExpiresAt': '2020-01-01T00:00:00Z', 'role': 'USER', 'conditions': [], 'allergies': []},
        {'id': 'n1', 'username': 'noExpUser', 'email': 'n@x.co', 'plan': 'Free', 'storedPlan': 'Premium', 'premiumStatus': 'no_expiry', 'premiumExpiresAt': None, 'role': 'USER', 'conditions': [], 'allergies': []}]
    state['admin_me'] = 200
    c = ctx_for(b, viewport={'width': 1280, 'height': 800}); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('medai_token','tok')")
    pg.goto(BASE + 'admin.html'); pg.wait_for_timeout(1500)
    pg.evaluate("typeof showSection==='function' ? showSection('users') : null"); pg.wait_for_timeout(1200)
    body = pg.inner_text('body').lower()
    check('admin: active Premium badge, expired shown as Free · expired + date, no-expiry flagged', 'premium' in body and 'expired 2020-01-01' in body and 'no expiry set' in body, body[-400:].replace('\n', ' '))
    check('admin: Premium count counts only ACTIVE subscriptions (1 of 3)', pg.inner_text('#stat-premium-count').strip() == '1', pg.inner_text('#stat-premium-count'))
    check('admin: no JS errors on the users view', not errs, str(errs[:2]))
    c.close(); state['admin_users'] = []


    # ---------- logout: token + current user removed, nothing else of the user's data, no authenticated requests afterwards ----------
    SECRET = 'SECRET_TOKEN_123'
    c = ctx_for(b, viewport={'width': 1280, 'height': 800}); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    reqs = []
    pg.on('request', lambda r: reqs.append((r.url, r.headers.get('authorization'))) if re.match(API, r.url) else None)
    pg.add_init_script("""if(!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded','1');
      localStorage.setItem('medai_token','%s'); localStorage.setItem('medai_current_user', JSON.stringify(%s));
      localStorage.setItem('medai_users', JSON.stringify([{username:'tester',email:'t@t.co'},{username:'other',email:'o@t.co'}]));
      localStorage.setItem('medai_triage_history_tester','[{"id":1}]'); localStorage.setItem('medai_theme','dark'); localStorage.setItem('medai_language','en');
      sessionStorage.setItem('medai_admin_session','active'); }""" % (SECRET, json.dumps(USER)))
    pg.goto(BASE + 'dashboard.html'); pg.wait_for_timeout(1500)
    check('before logout the session token is saved and used on API calls', pg.evaluate("localStorage.getItem('medai_token')") == SECRET and any(a == 'Bearer ' + SECRET for _, a in reqs), str(reqs[:3]))
    pg.evaluate("logoutUser()")
    st = pg.evaluate("""({token: localStorage.getItem('medai_token'), user: localStorage.getItem('medai_current_user'),
      adminSession: sessionStorage.getItem('medai_admin_session'),
      users: localStorage.getItem('medai_users'), triage: localStorage.getItem('medai_triage_history_tester'),
      theme: localStorage.getItem('medai_theme'), lang: localStorage.getItem('medai_language')})""")
    check('logout removes the bearer token, the current user and the admin-session marker immediately', st['token'] is None and st['user'] is None and st['adminSession'] is None, str(st))
    check('logout leaves unrelated data alone (saved-accounts list, triage history cache, theme, language)', st['users'] and st['triage'] and st['theme'] == 'dark' and st['lang'] == 'en', str(st))
    n_before = len(reqs)
    stale = pg.evaluate("""(async () => { const r = await fetch(API_BASE_URL + '/api/profile', { headers: { Authorization: 'Bearer %s' } }); return r.status; })()""" % SECRET)
    pg.wait_for_timeout(300)
    check('after logout a request that still holds the old token is stopped locally (401) and never reaches the network', stale == 401 and len(reqs) == n_before, f'{stale} {reqs[n_before:]}')
    pg.wait_for_url('**/Login_page.html', timeout=5000)
    check('logout redirects to the login page', pg.url.endswith('Login_page.html'), pg.url)
    check('no API request after logout carried the old token', not any(a and SECRET in a for _, a in reqs[n_before:]), str(reqs[n_before:]))
    c.close()

    # back/forward-cache restore of the dashboard with no token goes to login
    c = ctx_for(b, viewport={'width': 1280, 'height': 800}); pg = c.new_page()
    pg.add_init_script("if(!sessionStorage.getItem('s2')){sessionStorage.setItem('s2','1');localStorage.setItem('medai_token','tok');localStorage.setItem('medai_current_user', JSON.stringify(%s));}" % json.dumps(USER))
    pg.goto(BASE + 'dashboard.html'); pg.wait_for_timeout(1200)
    pg.evaluate("localStorage.removeItem('medai_token')")
    pg.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))")
    pg.wait_for_url('**/Login_page.html', timeout=5000)
    check('a dashboard restored from the back/forward cache without a token is sent to login', pg.url.endswith('Login_page.html'), pg.url)
    c.close()


    # ---------- normal login is unchanged: token + user stored, then the dashboard opens ----------
    c = ctx_for(b, viewport={'width': 1280, 'height': 800}); pg = c.new_page()
    pg.goto(BASE + 'Login_page.html'); pg.wait_for_timeout(800)
    pg.fill('#username', 'tester'); pg.fill('#password', 'passw0rd!'); pg.press('#password', 'Enter')
    pg.wait_for_url('**/dashboard.html', timeout=6000)
    saved = pg.evaluate("({t: localStorage.getItem('medai_token'), u: JSON.parse(localStorage.getItem('medai_current_user')||'{}').username})")
    check('password login still stores the token and current user and opens the dashboard', saved == {'t': 'LOGIN_TOKEN', 'u': 'tester'}, str(saved))
    c.close()

    # ---------- doctor dashboard: refused conversation is reported, not swallowed ----------
    state['convo'] = (403, {'message': 'You can only message patients who have booked an appointment with you or started a conversation with you.'})
    c = ctx_for(b, viewport={'width': 1280, 'height': 800}); pg = c.new_page(); dialogs = []
    pg.on('dialog', lambda d: (dialogs.append(d.message), d.dismiss()))
    pg.add_init_script("localStorage.setItem('medai_doctor_token','tok')")
    pg.goto(BASE + 'doctor-dashboard.html'); pg.wait_for_timeout(1000)
    pg.evaluate("openConversation('someone-else')"); pg.wait_for_timeout(500)
    check('doctor UI shows the backend refusal when a conversation is not allowed', any('only message patients' in d for d in dialogs), str(dialogs))
    c.close()

    # ---------- layout: no horizontal overflow, no JS errors (phone + desktop) ----------
    state['admin_me'] = 200
    for name, vp, mobile in [('phone 390px', {'width': 390, 'height': 844}, True), ('desktop 1280px', {'width': 1280, 'height': 800}, False)]:
        bad = []
        c = ctx_for(b, viewport=vp, is_mobile=mobile, has_touch=mobile)
        for p in PAGES:
            pg = c.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)[:100]))
            if p in ('dashboard.html', 'admin.html'):
                pg.add_init_script("localStorage.setItem('medai_token','tok');localStorage.setItem('medai_current_user',%s)" % json.dumps(json.dumps(USER)))
            pg.goto(BASE + p); pg.wait_for_timeout(900)
            ov = pg.evaluate("document.documentElement.scrollWidth-window.innerWidth")
            if ov > 1 or errs: bad.append((p, ov, errs[:1]))
            pg.close()
        check(f'{name}: {len(PAGES)} pages load with no horizontal scroll and no JS errors', not bad, str(bad))
        c.close()
    b.close()
httpd.shutdown()
failed = [r for r in results if not r[0]]
print(f'\n{len(results) - len(failed)}/{len(results)} browser checks passed')
sys.exit(1 if failed else 0)
