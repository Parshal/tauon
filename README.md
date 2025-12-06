# 📄 **README.md**

````markdown
# Tauon — Tiny Local Markdown Viewer

A minimal Flask-based Markdown viewer that serves the **current directory** over
`http://127.0.0.1:8000`. No magic, no complexity — just open a terminal, run
`tauon`, and browse your notes.

---

## 📦 Requirements

Debian / Ubuntu:

```bash
sudo apt install python3-flask python3-markdown
````

Or, if you prefer pip:

```bash
pip install flask markdown
```

---

## ⚙️ Installation

Run:

```bash
./install.sh
```

This creates a symlink:

```
/usr/local/bin/tauon → tauon.sh
```

The launcher simply runs `app.py` with the **current working directory** as the
Markdown root.

---

## 🚀 Usage

From any directory containing `.md` files:

```bash
tauon
```

Then open:

* [http://127.0.0.1:8000](http://127.0.0.1:8000)
* or **Ctrl+click** the address in the `* Running on http://127.0.0.1:8000` line in your terminal

---

## 📝 What It Does

* Serves Markdown files from *exactly where you run it*
* Renders them cleanly in your browser
* Uses only Flask + Markdown — nothing more

If you want a tiny, predictable, dependency-light Markdown viewer
that never touches your system outside `/usr/local/bin/tauon`,
Tauon does exactly that.

---

## 📓 Log / Stats Markdown Enhancements

Tauon ships with a small client-side enhancement pass (see `static/js/layout.js`) that
makes journaling-friendly cards directly from plain Markdown:

* `### [log] ...` &rarr; wraps each tagged H3 and its following siblings into a `.log-entry`
  card, strips the `[log]` tag from the visible heading, and keeps pulling content until the
  next non-`[stats]` heading. In other viewers it remains normal Markdown.
* `#### [stats] ...` inside a log card becomes a right-aligned `log-stats` band. Consecutive
  stats lines blend together, while the last one anchors to the card bottom for that "data
  panel" vibe. Outside Tauon, it renders as a standard H4.
* Visual styling lives in `static/css/layout.css` (`.log-entry`, `.log-stats`,
  `.log-stats-last`) so you can tweak the softcard, hover, or footer-panel look without touching
  the Markdown.

Usage pattern: log entries become timestamp cards, optional stats blocks act as compact
summary bands inside the same entry, and the raw Markdown stays portable everywhere else.

---

## 🪶 License

MIT — absolutely free to use, modify, or embed into your workflow.

```

---

If you want the playful “tiny ASCII logo” version or a sleek badge-style header, I can generate that too.
```
