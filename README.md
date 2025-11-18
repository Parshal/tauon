Requires flask and markdown, debian: apt install python3-flask python3-markdown

./install.sh creates a symlink /usr/local/bin/tauon to tauon.sh which runs app.py

tauon starts local Flask server that views markdown files from the current directory

type http://127.0.0.1:8000 in browser or ctrl+click the "* Running on http://127.0.0.1:8000" text in terminal
