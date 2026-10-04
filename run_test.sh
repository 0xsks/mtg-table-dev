node server.js &
SERVER_PID=$!
sleep 5
curl -k https://127.0.0.1:8888/api/health
curl -k "https://127.0.0.1:8888/api/cards?q=fire"
kill $SERVER_PID
