const https = require('https');
const query = '"Clemson" head baseball coach roster';
const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
https.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } }, (res) => {
  let body = "";
  res.on("data", (c) => (body += c));
  res.on("end", () => {
    const snippets = [];
    const regex = /class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = regex.exec(body)) !== null) {
      snippets.push(match[1].replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim());
    }
    console.log(snippets);
  });
});
