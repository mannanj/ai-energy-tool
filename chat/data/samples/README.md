# Sample chats

Generated 2026-09-27 on the **seed** copy of the editor tree (12 squares). Flow: the editor tree walked by code;
reader Jev; wording DeepSeek, reviewed by Jev; resident played by DeepSeek. Open in the inspector: http://localhost:8972/admin
Earlier sets: `data/samples-archive/`.

Three to review, the only unarchived chats (36 earlier ones are archived in the same database and still open at their links):
- off-topic-water-bill: declined in one reply, chat closed
- pipp-electric-heat: opening question → Step 0 → screener → income → Branch A, B1, B2, C, D, E all at once
- over-income-behind: same path; "No" to the income question has no arrow in the seed tree, so it fell to the "Nothing matched" square on the second try

What these show about the tree itself (fix in the editor, then press ↻ rerun in the inspector):
- the screener is one square holding seven questions, so the helper asks all seven at once
- the income square has "Yes" and "Either" arrows but no "No" arrow
- every branch square is a leaf, so the chat ends after the income question with six branches in one reply
