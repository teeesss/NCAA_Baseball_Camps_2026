const axios = require("axios");
const cheerio = require("cheerio");

axios
  .get(
    "https://en.wikipedia.org/wiki/List_of_NCAA_Division_II_baseball_programs",
    {
      headers: { "User-Agent": "NCAA-Camp-Compiler/1.0 (rayjonesy@gmail.com)" },
    },
  )
  .then((res) => {
    const $ = cheerio.load(res.data);
    console.log("Tables: " + $("table.wikitable").length);
    $("table.wikitable").each((i, tb) => {
      console.log(
        "Table " +
          i +
          ": " +
          $(tb)
            .find("th")
            .map((j, el) => $(el).text().trim())
            .get()
            .join(", "),
      );
    });
  });
