import asyncio, json, os, sys, urllib.request
from playwright.async_api import async_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:3010")
API = os.environ.get("E2E_API", "http://localhost:8971")
COOKIE = os.environ.get("E2E_COOKIE", "")
BROWSERS = os.environ.get("E2E_BROWSERS", "chromium,webkit").split(",")
MUTATE = os.environ.get("E2E_MUTATE", "1") == "1"
failures = []


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))
    if not ok:
        failures.append(name)


def api(path, method="GET", body=None):
    req = urllib.request.Request(API + path, method=method, data=body, headers={"Content-Type": "application/json", "Cookie": COOKIE, "User-Agent": "Mozilla/5.0 (e2e)"})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, e.read()


async def page_with_session(ctx):
    if COOKIE:
        from urllib.parse import urlparse
        host = urlparse(BASE).hostname
        await ctx.add_cookies([{"name": k, "value": v, "domain": host, "path": "/"} for k, v in (p.split("=", 1) for p in COOKIE.split("; "))])
    return await ctx.new_page()


async def open_chats(pg, query="panel=chats"):
    await pg.goto(f"{BASE}/?{query}", wait_until="networkidle")
    await pg.wait_for_selector("text=Tree:", timeout=40000)
    await pg.wait_for_selector(".react-flow__node-bubble", timeout=40000)
    await pg.wait_for_timeout(800)


async def visible_in(pg, inner, outer):
    return await pg.evaluate(
        """([a, b]) => { const r = a.getBoundingClientRect(), o = b.getBoundingClientRect(); return r.top >= o.top - 1 && r.bottom <= o.bottom + 1 && r.height > 0; }""",
        [await inner.element_handle(), await outer.element_handle()])


async def chats_on_map(pg):
    return {await n.get_attribute("data-chat") for n in await pg.locator(".react-flow__node-bubble [data-chat]").all()}


async def pan_to(pg, target):
    box = await target.bounding_box()
    pane = await pg.locator(".react-flow__pane").bounding_box()
    goal_x, goal_y = pane["x"] + 200, pane["y"] + pane["height"] / 2
    sx, sy = await pg.evaluate("""() => { const pane = document.querySelector('.react-flow__pane').getBoundingClientRect(); for (let fy = 0.15; fy < 0.95; fy += 0.1) for (let fx = 0.15; fx < 0.6; fx += 0.1) { const x = pane.left + pane.width * fx, y = pane.top + pane.height * fy; const e = document.elementFromPoint(x, y); if (e && e.classList.contains('react-flow__pane')) return [x, y]; } return [pane.left + 100, pane.top + 100]; }""")
    await pg.mouse.move(sx, sy)
    await pg.mouse.down()
    await pg.mouse.move(sx + (goal_x - box["x"]), sy + (goal_y - box["y"]), steps=12)
    await pg.mouse.up()
    await pg.wait_for_timeout(300)


async def viewport_transform(pg):
    return await pg.locator(".react-flow__viewport").get_attribute("style")


def pick_chats():
    status, d = api("/api/admin/chats")
    assert status == 200, status
    chats = [c for c in d["chats"] if c["messages"]]
    long = max(chats, key=lambda c: len(c["messages"]))
    far = max((m for m in long["messages"] if m["role"] == "user"), key=lambda m: m["seq"])
    other = next(c for c in chats if c["id"] != long["id"] and len(c["messages"]) >= 2)
    return long, far, other


async def run(browser_name, p, long, far, other):
    tag = f"[{browser_name}] "
    b = await getattr(p, browser_name).launch()
    ctx = await b.new_context(viewport={"width": 1600, "height": 1000})
    pg = await page_with_session(ctx)
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)) if "ResizeObserver loop" not in str(e) else None)
    panel = pg.locator("[data-testid='chat-panel']")
    scroller = panel
    far_text = far["content"][:30]

    await open_chats(pg)
    n_chats = len(await chats_on_map(pg))
    check(tag + "all chats: map draws bubbles for more than one chat", n_chats > 1, str(n_chats))
    check(tag + "all chats: panel lists the history", await pg.locator("text=History (").count() == 1)

    far_bubble = pg.locator(f".react-flow__node-bubble [data-seq='{far['seq']}']")
    check(tag + "map: the far message of the long chat is a bubble", await far_bubble.count() == 1)
    await pan_to(pg, far_bubble)
    check(tag + "map: dragging the pane pans to the bubble", (await far_bubble.bounding_box())["x"] > 0)
    await far_bubble.click()
    await pg.wait_for_timeout(700)
    check(tag + "bubble click: panel opens that chat", await panel.get_attribute("data-chat") == long["id"])
    panel_msg = pg.locator(f"[data-testid='chat-scroll'] [data-seq='{far['seq']}']")
    check(tag + "bubble click: panel scrolls to the clicked message", await panel_msg.count() == 1 and await visible_in(pg, panel_msg, scroller))
    check(tag + "bubble click: the clicked message is highlighted in the panel", "ring-2" in (await panel_msg.get_attribute("class") or ""))
    check(tag + "bubble click: url carries the chat", f"chat={long['id']}" in pg.url)
    check(tag + "bubble click: sticky header names the chat", long["scenario"] in await pg.locator("[data-testid='chat-head']").inner_text())
    chips = pg.locator("[data-testid='chat-chips'] button")
    check(tag + "bubble click keeps the other chats on the map, as chips", await chips.count() == n_chats)

    await chips.filter(has_text=other["scenario"] or other["title"][:20]).first.click()
    await pg.wait_for_timeout(500)
    check(tag + "chip: switches the panel to the other chat", await panel.get_attribute("data-chat") == other["id"])
    check(tag + "chip: panel starts at the top of the other chat", await scroller.evaluate("e => e.scrollTop") == 0)
    first_msg = pg.locator(f"[data-testid='chat-scroll'] [data-seq='{other['messages'][0]['seq']}']")
    check(tag + "chip: first message visible", await visible_in(pg, first_msg, scroller))

    await pg.click("text=← All chats")
    await pg.wait_for_timeout(400)
    check(tag + "all chats: url drops the chat", "chat=" not in pg.url)
    n_after = len(await chats_on_map(pg))
    check(tag + "all chats: map shows every chat again", n_after == n_chats, f"{n_after} vs {n_chats}")

    await pg.locator(f"[data-testid='chat-list'] [data-chat='{long['id']}']").click()
    await pg.wait_for_timeout(700)
    only = await chats_on_map(pg)
    check(tag + "list click: map shows only that chat", only == {long["id"]}, str(only))
    stacks = await pg.evaluate("""() => [...document.querySelectorAll('.react-flow__node-bubble [data-chat]')].map(b => ({ id: b.closest('.react-flow__node').dataset.id, first: +b.querySelector('[data-seq]').dataset.seq, visit: b.querySelector('[data-testid=stack-visit]') ? b.querySelector('[data-testid=stack-visit]').textContent : '' }))""")
    threads = await pg.evaluate("""() => [...document.querySelectorAll('.react-flow__edge')].map(e => e.dataset.id).filter(id => id.startsWith('t:'))""")
    by_first = sorted(stacks, key=lambda st: st["first"])
    expected = [f"t:{a['id']}:{b['id']}" for a, b in zip(by_first, by_first[1:])]
    check(tag + "threads: every stack is joined to the next in time order, one line, no gaps", sorted(threads) == sorted(expected), f"{len(threads)} threads for {len(stacks)} stacks")
    check(tag + "threads: a stack holds consecutive messages only", await pg.evaluate("""() => [...document.querySelectorAll('.react-flow__node-bubble [data-chat]')].every(b => { const s = [...b.querySelectorAll('[data-seq]')].map(x => +x.dataset.seq); return s.every((v, i) => i === 0 || v === s[i - 1] + 1); })"""))
    squares = await pg.evaluate("""() => [...document.querySelectorAll('.react-flow__edge')].map(e => e.dataset.id).filter(id => id.startsWith('a:'))""")
    revisit = [m for m in long["messages"] if m["role"] == "assistant" and m["node_ids"]]
    has_revisit = len({m["node_ids"][0] for m in revisit}) < len(revisit)
    check(tag + "threads: a revisited square gets its own later bubble, marked as a revisit", (not has_revisit) or any(st["visit"] for st in stacks), str([st["visit"] for st in stacks]))
    check(tag + "threads: every stack is anchored to a square", len(squares) == len(stacks), f"{len(squares)} anchors, {len(stacks)} stacks")
    overlaps = await pg.evaluate("""() => { const r = [...document.querySelectorAll('.react-flow__node-bubble')].map(n => n.getBoundingClientRect()); let o = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i].left < r[j].right && r[j].left < r[i].right && r[i].top < r[j].bottom && r[j].top < r[i].bottom) o++; return o; }""")
    check(tag + "threads: no two stacks of the chat overlap", overlaps == 0, f"{overlaps} overlaps")
    await scroller.evaluate("e => e.scrollTop = e.scrollHeight")
    await pg.wait_for_timeout(200)
    check(tag + "list click: panel scrolled down for the test", await scroller.evaluate("e => e.scrollTop") > 100)
    before = await viewport_transform(pg)
    await panel_msg.hover()
    await pg.wait_for_timeout(300)
    hot = pg.locator(f".react-flow__node-bubble [data-seq='{far['seq']}'] .ring-2")
    check(tag + "panel hover: bubble message lights up", await hot.count() == 1)
    tall_index = await pg.evaluate("() => [...document.querySelectorAll('[data-testid=stack-scroll]')].findIndex(e => e.scrollHeight > e.clientHeight + 20)")
    tall = pg.locator("[data-testid='stack-scroll']").nth(tall_index)
    if tall_index >= 0:
        tall_last = await tall.evaluate("e => { const s = e.querySelectorAll('[data-seq]'); return +s[s.length - 1].dataset.seq; }")
        await tall.evaluate("e => e.scrollTop = 0")
        await pg.locator(f"[data-testid='chat-scroll'] [data-seq='{tall_last}']").hover()
        await pg.wait_for_timeout(300)
        check(tag + "panel hover: message scrolled into view inside its stack", await visible_in(pg, tall.locator(f"[data-seq='{tall_last}']"), tall))
    else:
        check(tag + "panel hover: found a scrollable stack", False)
    await panel_msg.click()
    await pg.wait_for_timeout(800)
    check(tag + "panel click: map moves to the message", await viewport_transform(pg) != before)

    if tall_index >= 0:
        tall_first = await tall.evaluate("e => +e.querySelector('[data-seq]').dataset.seq")
        await pg.locator(f"[data-testid='chat-scroll'] [data-seq='{tall_first}']").click()
        await pg.wait_for_timeout(900)
        await tall.evaluate("e => e.scrollTop = 0")
        box = await tall.bounding_box()
        await pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        tf = await viewport_transform(pg)
        await pg.mouse.wheel(0, 120)
        await pg.wait_for_timeout(400)
        check(tag + "stack wheel: scrolls the stack", await tall.evaluate("e => e.scrollTop") > 0)
        check(tag + "stack wheel: does not zoom or pan the map", await viewport_transform(pg) == tf)
    else:
        check(tag + "stack wheel: found a scrollable stack", False)

    await pg.click("text=← All chats")
    await pg.locator(f"[data-testid='chat-list'] [data-chat='{other['id']}']").click()
    await pg.wait_for_timeout(500)
    check(tag + "list click after scroll: other chat opens at the top", await panel.get_attribute("data-chat") == other["id"] and await scroller.evaluate("e => e.scrollTop") == 0)

    await open_chats(pg, f"panel=chats&chat={long['id']}")
    check(tag + "url load: panel shows the chat from the url", await panel.get_attribute("data-chat") == long["id"])
    only = await chats_on_map(pg)
    check(tag + "url load: map shows only that chat", only == {long["id"]}, str(only))

    await pg.goto(f"{BASE}/?panel=chats&chat=nope-{long['id']}", wait_until="networkidle")
    await pg.wait_for_selector("text=History (", timeout=40000)
    await pg.wait_for_timeout(800)
    check(tag + "stale url: unknown chat falls back to the list", await panel.count() == 0)
    check(tag + "stale url: the bad chat id is dropped from the url", "chat=" not in pg.url)
    check(tag + "stale url: map still shows every chat", len(await chats_on_map(pg)) == n_chats)

    if MUTATE:
        await pg.locator(f"[data-testid='chat-list'] [data-chat='{other['id']}']").click()
        await pg.wait_for_timeout(400)
        await pg.click("[data-testid='chat-head'] >> text=archive")
        await pg.wait_for_timeout(800)
        check(tag + "archive current: panel returns to the list", await panel.count() == 0 and await pg.locator("text=History (").count() == 1)
        check(tag + "archive current: url drops the chat", "chat=" not in pg.url)
        left = await chats_on_map(pg)
        check(tag + "archive current: map shows the remaining chats, not the archived one", other["id"] not in left and len(left) >= 1, str(left))
        status, _ = api("/api/admin/archive", "POST", json.dumps({"id": other["id"], "archived": False}).encode())
        check(tag + "archive current: restored over the api", status == 200, str(status))
        await pg.evaluate("window.dispatchEvent(new Event('focus'))")
        await pg.wait_for_timeout(1200)
        check(tag + "fresh data: window focus reloads the list from the server", await pg.locator(f"[data-testid='chat-list'] [data-chat='{other['id']}']").count() == 1)

    async with pg.expect_popup() as popup_info:
        await pg.click("button[title='Open in a new window']")
    pop = await popup_info.value
    await pop.wait_for_selector("button:has-text('Chat')", timeout=40000)
    await pop.click("button:has-text('Chat')")
    await pop.wait_for_selector(f"[data-testid='chat-list'] [data-chat='{long['id']}']", timeout=40000)
    await pop.locator(f"[data-testid='chat-list'] [data-chat='{long['id']}']").click()
    await pg.wait_for_timeout(900)
    only = await chats_on_map(pg)
    check(tag + "popout: picking a chat there syncs the main map", only == {long["id"]}, str(only))
    check(tag + "popout: and the main panel", await panel.get_attribute("data-chat") == long["id"])
    await pop.locator(f"[data-testid='chat-scroll'] [data-seq='{far['seq']}']").click()
    await pg.wait_for_timeout(900)
    check(tag + "popout: clicking a message lights the bubble on the main map", await pg.locator(f".react-flow__node-bubble [data-seq='{far['seq']}'] .ring-2").count() == 1)
    await pop.close()

    check(tag + "no page errors", not errors, "; ".join(errors)[:300])
    await b.close()


async def main():
    long, far, other = pick_chats()
    print(f"long chat {long['id']} ({long['scenario']}, {len(long['messages'])} messages), far seq {far['seq']}; other {other['id']}")
    async with async_playwright() as p:
        for name in BROWSERS:
            await run(name, p, long, far, other)
    print(f"\n{len(failures)} failures" if failures else "\nall passed")
    for f in failures:
        print("  " + f)
    sys.exit(1 if failures else 0)


asyncio.run(main())
