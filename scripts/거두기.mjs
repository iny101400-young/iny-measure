/**
 * 엔진마다 나온 인용-{엔진}.json 을 한 표로 모아 인용.md 에 오늘 줄을 더한다.
 *
 * ★ 어제 줄을 안 지운다. 날마다 한 줄씩 는다.
 * ★ 오늘 잰 것만 센다. json 안의 잰때 가 오늘이 아니면 「어제 것」으로 표시한다.
 *
 * 쓰는 법
 *   node 거두기.mjs {outputs/08-measure/슬러그 폴더}
 */
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) { console.log("쓰는 법: node 거두기.mjs {08-measure/슬러그 폴더}"); process.exit(1); }

const 엔진들 = ["perplexity", "google", "naver", "chatgpt"];
const 오늘 = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); // 이 컴퓨터 날짜
const 색인 = (() => { try { return JSON.parse(fs.readFileSync(path.join(dir, "색인.json"), "utf8")).빙색인; } catch { return "?"; } })();

const 표 = new Map(); // id → { 질문, 엔진: 판정 }
for (const e of 엔진들) {
  const f = path.join(dir, `인용-${e}.json`);
  if (!fs.existsSync(f)) continue;
  for (const r of JSON.parse(fs.readFileSync(f, "utf8"))) {
    const row = 표.get(r.id) ?? { 질문: r.질문 ?? r.id };
    const 오늘것 = (r.잰때 ?? "").slice(0, 10) === 오늘;
    row[e] = (오늘것 ? "" : "(어제)") + (r.판정 ?? "?") + (r.순위 ? ` ${r.순위}위` : "");
    표.set(r.id, row);
  }
}

const md = path.join(dir, "인용.md");
const head = "| 날짜 | 색인 | 질문 | " + 엔진들.join(" | ") + " |\n|---|---|---|" + 엔진들.map(() => "---").join("|") + "|\n";
let out = fs.existsSync(md) ? fs.readFileSync(md, "utf8") : "# 인용 · 날마다 한 줄씩\n\n" + head;
for (const [, row] of 표) {
  out += `| ${오늘} | ${색인} | ${row.질문} | ` + 엔진들.map((e) => row[e] ?? "–").join(" | ") + " |\n";
}
fs.writeFileSync(md, out, "utf8");

const 셈 = (p) => [...표.values()].flatMap((r) => 엔진들.map((e) => r[e] ?? "")).filter((v) => v.startsWith(p)).length;
console.log(`${오늘} · 색인 ${색인} · 질문 ${표.size}개 × 엔진 ${엔진들.length}`);
console.log(`A ${셈("A")} · B ${셈("B")} · C ${셈("C")} · 못잼 ${셈("못잼")}  → ${md}`);
