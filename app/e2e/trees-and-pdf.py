import asyncio, json, os, sys, time, urllib.request
from playwright.async_api import async_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:3010")
API = os.environ.get("E2E_API", "http://localhost:8971")
COOKIE = os.environ.get("E2E_COOKIE", "")
MUTATE = os.environ.get("E2E_MUTATE", "1") == "1"
PDF = os.path.join(os.path.dirname(__file__), "..", "..", "context", "team-docs", "civic-signal-sources.pdf")
failures = []


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))
    if not ok:
        failures.append(name)


def api(path, method="GET", body=None, ctype="application/json"):
    req = urllib.request.Request(API + path, method=method, data=body, headers={"Content-Type": ctype, "Cookie": COOKIE, "User-Agent": "Mozilla/5.0 (e2e)"})
    try:
        with urllib.request.urlopen(req) as r:
            data = r.read()
            return r.status, (json.loads(data) if data[:1] in (b"{", b"[") else data)
    except urllib.error.HTTPError as e:
        return e.code, e.read()


async def page_with_session(ctx):
    if COOKIE:
        from urllib.parse import urlparse
        host = urlparse(BASE).hostname
        cookies = []
        for part in COOKIE.split("; "):
            k, v = part.split("=", 1)
            cookies.append({"name": k, "value": v, "domain": host, "path": "/"})
        await ctx.add_cookies(cookies)
    return await ctx.new_page()


async def open_tree(pg, tree_id):
    await pg.goto(f"{BASE}/?tree={tree_id}", wait_until="networkidle")
    await pg.wait_for_selector("text=Tree:", timeout=40000)


async def main():
    status, trees = api("/api/trees")
    check("api: list trees", status == 200 and any(t["id"] == "main" for t in trees["trees"]), str(status))
    has_civic = any(t["id"] == "civic-signal" for t in trees["trees"])
    check("api: civic-signal tree registered with pdf", has_civic and next(t for t in trees["trees"] if t["id"] == "civic-signal")["pdfKey"] == "trees/civic-signal.pdf")

    status, doc = api("/api/tree/civic-signal/export")
    n_sources = sum(len(n.get("sources") or []) for n in doc["nodes"]) if status == 200 else 0
    check("api: civic-signal export has squares, arrows, sources", status == 200 and len(doc["nodes"]) >= 50 and len(doc["edges"]) >= 50 and n_sources >= 70, f"{len(doc.get('nodes', []))} nodes, {n_sources} sources")

    status, pdf_head = api("/api/tree/civic-signal/pdf", ctype="application/pdf")
    check("api: civic-signal pdf served", status == 200 and pdf_head[:4] == b"%PDF", str(status))

    status, _ = api("/api/tree/main/pdf", ctype="application/pdf")
    check("api: main has no pdf (404)", status == 404, str(status))

    stamp = str(int(time.time()))
    if not MUTATE:
        await ui_only(n_sources, doc)
        return
    status, made = api("/api/trees", "POST", json.dumps({"name": f"e2e tree {stamp}"}).encode())
    check("api: create tree", status == 200 and made.get("id"), str(status))
    new_id = made.get("id") if status == 200 else None
    status, dup = api("/api/trees", "POST", json.dumps({"name": "dup", "id": "main"}).encode())
    check("api: duplicate id rejected", status == 409, str(status))
    status, noname = api("/api/trees", "POST", json.dumps({"name": ""}).encode())
    check("api: empty name rejected", status == 400, str(status))

    if new_id:
        status, ndoc = api(f"/api/tree/{new_id}/export")
        check("api: new tree has one root square with the given name", status == 200 and len(ndoc["nodes"]) == 1 and ndoc["nodes"][0]["isRoot"] and ndoc["tree"]["name"] == f"e2e tree {stamp}")
        status, vs = api(f"/api/tree/{new_id}/versions")
        check("api: new tree has a 'created' version", status == 200 and any(v["label"] == "created" for v in vs["versions"]))

    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1600, "height": 1000})
        pg = await page_with_session(ctx)
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))

        await open_tree(pg, "main")
        check("ui: main header shows tree name", "Rates went up (example)" in await pg.locator("button[title='Switch tree or start a new one']").inner_text())
        check("ui: center header has no squares/history/copy buttons", await pg.locator("button:has-text('copy tree')").count() == 0 and await pg.locator("button:has-text('history')").count() == 0)
        check("ui: main shows 'add PDF' since it has no pdf", await pg.locator("button:has-text('add PDF')").count() == 1)
        await pg.click("button[title='Switch tree or start a new one']")
        await pg.wait_for_timeout(800)
        check("ui: dropdown lists New tree and both trees", await pg.locator("text=New tree").count() == 1 and await pg.locator("a:has-text('Civic Signal decision tree')").count() == 1)
        await pg.click("a:has-text('Civic Signal decision tree')")
        await pg.wait_for_selector("text=Tree:", timeout=40000)
        await pg.wait_for_timeout(1500)
        check("ui: switching navigates to ?tree=civic-signal", "tree=civic-signal" in pg.url)
        check("ui: civic tree renders 50+ squares", await pg.locator(".react-flow__node.react-flow__node-square").count() >= 50)

        pg.once("dialog", lambda d: asyncio.ensure_future(d.accept(f"ui tree {stamp}")))
        await pg.click("button[title='Switch tree or start a new one']")
        await pg.wait_for_timeout(500)
        await pg.click("text=New tree")
        await pg.wait_for_url(lambda u: "tree=" in u and "civic-signal" not in u, timeout=40000)
        await pg.wait_for_selector("text=Tree:", timeout=40000)
        await pg.wait_for_timeout(1500)
        ui_tree_id = pg.url.split("tree=")[1].split("&")[0]
        check("ui: New tree creates and opens a fresh tree", f"ui tree {stamp}" in await pg.locator("button[title='Switch tree or start a new one']").inner_text(), pg.url)
        check("ui: fresh tree has exactly one (root) square", await pg.locator(".react-flow__node-square").count() == 1)

        root = pg.locator(".react-flow__node-square textarea").first
        await root.click()
        await root.fill(f"Root question {stamp}?")
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(1500)
        status, d1 = api(f"/api/tree/{ui_tree_id}/export")
        check("mutation: typed root text autosaved to the worker", status == 200 and d1["nodes"][0]["text"] == f"Root question {stamp}?")

        await pg.locator(".react-flow__node-square").first.click()
        await pg.keyboard.press("Tab")
        await pg.wait_for_timeout(600)
        await pg.keyboard.type("Child answer")
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(1500)
        status, d2 = api(f"/api/tree/{ui_tree_id}/export")
        check("mutation: Tab adds a connected child that persists", status == 200 and len(d2["nodes"]) == 2 and len(d2["edges"]) == 1 and any(n["text"] == "Child answer" for n in d2["nodes"]))

        await pg.reload(wait_until="networkidle")
        await pg.wait_for_selector("text=Tree:", timeout=40000)
        await pg.wait_for_timeout(1500)
        check("mutation: reload shows both squares", await pg.locator(".react-flow__node-square").count() == 2)

        status, cp = api(f"/api/tree/{ui_tree_id}/versions", "POST", json.dumps({"label": "e2e checkpoint"}).encode())
        check("history: checkpoint saved", status == 200 and cp.get("n"))
        child_id = next(n["id"] for n in d2["nodes"] if not n["isRoot"])
        await pg.locator(f".react-flow__node[data-id='{child_id}'] .cursor-grab").click()
        await pg.keyboard.press("Delete")
        await pg.wait_for_timeout(1500)
        status, d3 = api(f"/api/tree/{ui_tree_id}/export")
        check("mutation: Delete removes the child and its arrow", status == 200 and len(d3["nodes"]) == 1 and len(d3["edges"]) == 0)
        status, restored = api(f"/api/tree/{ui_tree_id}/versions/{cp.get('n')}/restore", "POST", b"{}")
        await pg.wait_for_timeout(1500)
        status, d4 = api(f"/api/tree/{ui_tree_id}/export")
        check("history: restore brings the child back", status == 200 and len(d4["nodes"]) == 2 and len(d4["edges"]) == 1)
        check("history: restore shows live on the open canvas", await pg.locator(".react-flow__node-square").count() == 2)
        status, vs = api(f"/api/tree/{ui_tree_id}/versions")
        labels = [v["label"] for v in vs["versions"]]
        check("history: before-restore and restored checkpoints recorded", any(l.startswith("before restore") for l in labels) and any(l.startswith("restored") for l in labels), ",".join(labels[:6]))

        pdf_bytes = open(PDF, "rb").read()
        status, up = api(f"/api/tree/{ui_tree_id}/pdf", "PUT", pdf_bytes, ctype="application/pdf")
        check("pdf: upload to a new tree", status == 200 and up.get("pdfKey") == f"trees/{ui_tree_id}.pdf", str(status))
        await pg.reload(wait_until="networkidle")
        await pg.wait_for_selector("button[title^='Show the source PDF']", timeout=40000)
        check("pdf: button switches from 'add PDF' to 'PDF' after upload", True)

        await pdf_checks(pg, n_sources, doc)
        check("ui: no page errors", not errors, "; ".join(errors)[:300])
        await b.close()

    finish()


async def ui_only(n_sources, doc):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1600, "height": 1000})
        pg = await page_with_session(ctx)
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        await open_tree(pg, "main")
        check("ui: main header shows tree name", "Rates went up (example)" in await pg.locator("button[title='Switch tree or start a new one']").inner_text())
        await pg.click("button[title='Switch tree or start a new one']")
        await pg.wait_for_timeout(800)
        check("ui: dropdown lists New tree and both trees", await pg.locator("text=New tree").count() == 1 and await pg.locator("a:has-text('Civic Signal decision tree')").count() == 1)
        await pg.keyboard.press("Escape")
        await pdf_checks(pg, n_sources, doc)
        check("ui: no page errors", not errors, "; ".join(errors)[:300])
        await b.close()
    finish()


def finish():
    print()
    print(f"{len(failures)} failures" if failures else "all checks passed")
    sys.exit(1 if failures else 0)


async def pdf_checks(pg, n_sources, doc):
        await open_tree(pg, "civic-signal")
        await pg.click("button[title^='Show the source PDF']")
        await pg.wait_for_selector("[data-source-label='1']", timeout=40000)
        await pg.wait_for_timeout(6000)
        check("pdf: panel node appears", await pg.locator(".react-flow__node[data-id='pdf']").count() == 1)
        n_labels = await pg.locator("[data-source-label]").count()
        check("pdf: one source line per source rectangle", n_labels == n_sources, f"{n_labels} vs {n_sources}")
        header = await pg.locator(".react-flow__node[data-id='pdf']").inner_text()
        check("pdf: three pages shown of seven", "pages 1–3 of 7" in header, header[:60])
        canvases = await pg.locator(".react-flow__node[data-id='pdf'] canvas").count()
        check("pdf: all pages rendered to canvases", canvases == 7, str(canvases))
        hl = await pg.locator("[title^='source '][title*=': hover']").count()
        check("pdf: every source has a highlight in the pdf", hl == n_sources, f"{hl}")

        await pg.evaluate("document.querySelector(\"[data-source-label='40']\").dispatchEvent(new MouseEvent('click', {bubbles:true}))")
        await pg.wait_for_timeout(1500)
        active = await pg.evaluate("[...document.querySelectorAll('.animate-pulse')].map(e => e.title.split(':')[0])")
        header = await pg.locator(".react-flow__node[data-id='pdf']").inner_text()
        check("pdf: clicking source 40 activates its highlight and scrolls the pdf", active == ["source 40"] and "pages 1–3" not in header, f"{active} {header[:40]}")
        r = await pg.evaluate("(() => { const g=document.querySelector(\"[data-source-label='69']\"); const r=g.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]; })()")
        check("pdf: label 69 visible on screen for a real click", 0 < r[0] < 1600 and 0 < r[1] < 1000, str(r))
        await pg.mouse.click(r[0], r[1])
        await pg.wait_for_timeout(1500)
        active = await pg.evaluate("[...document.querySelectorAll('.animate-pulse')].map(e => e.title.split(':')[0])")
        check("pdf: real mouse click on a label jumps", active == ["source 69"], str(active))
        lit = await pg.evaluate("[...document.querySelectorAll('.react-flow__node-square > div')].filter(d => d.style.transform.includes('scale')).length")
        check("pdf: the square of the active source is grown", lit >= 1, str(lit))
        await pg.mouse.move(5, 500)
        await pg.wait_for_timeout(400)
        r = await pg.evaluate("(() => { const els=[...document.querySelectorAll(\"[title^='source '][title*=': hover']\")]; const inside = els.map(e => { const b=e.getBoundingClientRect(); const box=document.querySelector('[data-id=pdf] .overflow-y-auto').getBoundingClientRect(); return [e, b, box]; }).find(([e,b,box]) => b.y > box.y + 10 && b.y + b.height < box.y + box.height - 10 && b.x > 0); const [e,b] = inside; return [b.x + b.width/2, b.y + b.height/2, e.title.split(':')[0]]; })()")
        await pg.mouse.move(r[0], r[1])
        await pg.wait_for_timeout(500)
        lit = await pg.evaluate("[...document.querySelectorAll('.react-flow__node-square > div')].filter(d => d.style.transform.includes('scale')).length")
        check("pdf: hovering a highlight grows its square", lit >= 1, f"{r[2]} lit={lit}")
        under = await pg.evaluate(f"document.elementsFromPoint({r[0]}, {r[1]}).filter(e => e.title && e.title.startsWith('source ')).map(e => e.title.split(':')[0])")
        await pg.mouse.click(r[0], r[1])
        await pg.wait_for_timeout(1200)
        active = await pg.evaluate("[...document.querySelectorAll('.animate-pulse')].map(e => e.title.split(':')[0])")
        check("pdf: clicking a highlight makes it the active source", len(active) == 1 and active[0] in under, f"{active} of {under}")
        await pg.click("button[title='Next page']")
        await pg.wait_for_timeout(1000)
        header2 = await pg.locator(".react-flow__node[data-id='pdf']").inner_text()
        check("pdf: page arrows move the window", header2 != header, header2[:40])
        await pg.click("button[title='Hide the PDF']")
        await pg.wait_for_timeout(500)
        check("pdf: close hides panel and lines", await pg.locator(".react-flow__node[data-id='pdf']").count() == 0 and await pg.locator("[data-source-label]").count() == 0)

        await open_tree(pg, "civic-signal")
        sq = pg.locator(".react-flow__node-square").nth(3)
        sid = await sq.get_attribute("data-id")
        before = next(n for n in doc["nodes"] if n["id"] == sid)
        await sq.locator("textarea").click()
        await pg.keyboard.press("End")
        await pg.keyboard.type(" [e2e]")
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(1500)
        status, d5 = api("/api/tree/civic-signal/export")
        after = next(n for n in d5["nodes"] if n["id"] == sid)
        check("mutation: editing a sourced square keeps its sources", after["text"].endswith(" [e2e]") and after.get("sources") == before.get("sources"))
        await sq.locator("textarea").click()
        await pg.keyboard.press("End")
        for _ in range(6):
            await pg.keyboard.press("Backspace")
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(1500)
        status, d6 = api("/api/tree/civic-signal/export")
        check("mutation: edit reverted cleanly", next(n for n in d6["nodes"] if n["id"] == sid)["text"] == before["text"])


asyncio.run(main())
