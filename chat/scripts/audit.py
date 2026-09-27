"""Check saved chats: every phone number and link the helper said must exist in the tree the chat ran on
(data/tree.json, else data/tree.seed.json) or in the sourced markdown; no source tags leak.
Also prints how many replies were DeepSeek-written vs square-verbatim, and why verbatim was used."""
import re, sqlite3, sys, os, json, collections
here = os.path.dirname(os.path.abspath(__file__))
tp = os.path.join(here, "../data/tree.json")
if not os.path.exists(tp): tp = os.path.join(here, "../data/tree.seed.json")
doc = json.load(open(tp))
tree = "\n".join(n["text"] for n in doc["nodes"]) + "\n" + open(os.path.join(here, "../../context/decision-tree-assistance.md")).read()
db = sqlite3.connect(os.path.join(here, "../data/chats.sqlite"))
norm = lambda s: re.sub(r"\D", "", s)
PHONE = r"\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}"
URL = r"[a-z0-9.-]+\.(?:gov|org|com|net)(?:/[^\s)\]`*]*)?"
tree_phones = {norm(p) for p in re.findall(PHONE, tree)} | {"211", "711"}
tree_hosts = {u.split("/")[0].lower() for u in re.findall(URL, tree, re.I)} | {"211virginia.org"}
only = sys.argv[1] if len(sys.argv) > 1 else None
rows = db.execute("select c.id, c.scenario, m.content, m.review from messages m join chats c on c.id=m.chat_id where m.role='assistant'" + (" and c.scenario=?" if only else ""), (only,) if only else ()).fetchall()
problems, n, used, reasons = {}, 0, collections.Counter(), collections.Counter()
for cid, scen, content, review in rows:
    n += 1
    key = f"{scen or 'web'} ({cid})"
    for p in re.findall(PHONE, content):
        if norm(p) not in tree_phones: problems.setdefault(key, set()).add("phone not in tree: " + p)
    for u in re.findall(URL, content, re.I):
        if u.split("/")[0].lower() not in tree_hosts: problems.setdefault(key, set()).add("link not in tree: " + u)
    for s in re.findall(r"\[src:[^\]]*\]|\bUNVERIFIED\b|\bVERIFIED\b|\bCHECK\b", content):
        problems.setdefault(key, set()).add("leaked tag: " + s)
    if review:
        r = json.loads(review); used[r.get("used")] += 1
        if r.get("used") == "verbatim": reasons[re.sub(r"[\d.]+", "#", r.get("reason") or "?")[:60]] += 1
    else: used["(no review, pre-writer)"] += 1
print(f"{n} helper messages checked across {len(set(r[0] for r in rows))} chats against {os.path.basename(tp)}")
print("wording:", dict(used))
for k, v in reasons.most_common(6): print(f"   verbatim because {k}: {v}")
if not problems: print("no invented numbers, links, or leaked tags"); sys.exit(0)
for k, v in problems.items():
    print(k); [print("   ", x) for x in sorted(v)]
sys.exit(1)
