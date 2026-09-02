/**
 * 이 주소가 빙 목록에 올랐나 확인한다. ego 브라우저로 빙에서 site: 검색을 한다.
 *
 * ★ 왜 빙인가. ChatGPT·Perplexity 가 빙 색인을 재료로 쓴다. 빙에 없으면 그 둘은 못 찾는다.
 * ★ 색인 전에 인용을 재면 전부 「안 나옴」이 나와 값을 못 믿는다. 그래서 인용재기 전에 이걸 먼저 돈다.
 *
 * 쓰는 법 · 환경변수 색인주소 에 글 주소를 준다. 결과는 환경변수 색인결과 (기본 /tmp/색인확인.json).
 */

import fs from "node:fs";

const 주소 = process.env.색인주소;
const 나온곳 = process.env.색인결과 || "/tmp/색인확인.json";
if (!주소) {
  cliLog("색인주소 환경변수에 글 주소를 준다.");
} else {
  await useOrCreateTaskSpace("색인 확인");
  const 겉 = 주소.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const 검색 = "https://www.bing.com/search?q=" + encodeURIComponent("site:" + 겉);
  let 결과;
  try {
    await gotoAndWait(검색, { timeout: 40, settle: 3 });
    await wait(4);
    const 뽑기 = await js(
      "(() => {" +
        "const a = [...document.querySelectorAll('li.b_algo h2 a, li.b_algo a[href^=\"http\"]')].map(x => x.href);" +
        "return { 링크: a.slice(0, 10), 글자: document.body.innerText.slice(0, 1500) };" +
        "})()"
    );
    const 있음 = 뽑기.링크.some((h) => h.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").startsWith(겉));
    결과 = { 주소, 빙색인: 있음 ? "있음" : "없음", 잰때: new Date().toISOString(), 나온링크: 뽑기.링크.slice(0, 5) };
    cliLog(주소 + " → 빙 색인 " + 결과.빙색인);
  } catch (e) {
    결과 = { 주소, 빙색인: "못잼", 왜: String(e).slice(0, 80), 잰때: new Date().toISOString() };
    cliLog("못 잼: " + 결과.왜);
  }
  fs.writeFileSync(나온곳, JSON.stringify(결과, null, 1), "utf8");
}
