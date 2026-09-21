/**
 * 글 한 편의 질문 M개가 AI 답변에 걸리나를 잰다. ego 브라우저가 사람 대신 물어본다.
 *
 * ★ 로그인을 안 한다. 로그인하면 그 계정 이력이 답에 섞여 남들이 보는 답과 달라진다.
 *
 * ★ 엔진마다 잴 수 있는 것이 다르다.
 *   perplexity  출처를 순서대로 준다        → 몇 번째인지까지 잰다
 *   google      AI 개요가 출처를 준다        → 〃
 *   naver       AI 브리핑이 출처를 준다      → 〃
 *   chatgpt     + 를 눌러 「웹 검색」을 켜야 뒤진다 → 출처 이름과 나온 순서
 *
 * 판정은 넷이다.
 *   A    출처로 걸림     내 도메인이 출처 목록에 있다
 *   B    이름만 언급됨   출처엔 없는데 답 글자 안에 내 이름이 있다
 *   C    안 나옴         둘 다 아니다
 *   못잼  못 읽었다       ★ C 가 아니다. 아래
 *
 * ★★ 「안 나옴」과 「못 읽었다」를 가르는 것이 이 스크립트의 제일 중요한 일이다.
 *
 *   엔진 화면은 계속 바뀐다. 바뀌면 출처를 못 읽는데, 그걸 그냥 C 로 적으면
 *   **안 나온 것처럼 쌓인다.** 값은 조용히 0 으로 내려가고 아무도 원인을 모른다.
 *
 *   실측에서 이렇게 났다.
 *     · 상자를 잘못 잡아 푸터에서 멈춘 판 → 출처 0개 → 145건이 전부 가짜 C
 *     · 웹 검색이 안 켜진 판             → 답이 웹을 안 뒤짐 → 전부 못잼이어야 했다
 *
 *   그래서 아래 셋 중 하나라도 걸리면 **C 가 아니라 못잼**이다.
 *     ① 지금 화면이 그 엔진 화면이 아니다      (딴 데로 튕겨 갔다)
 *     ② 답 상자를 못 찾았다                   (화면이 바뀌었다)
 *     ③ 출처를 하나도 못 뽑았다                (읽는 법이 안 맞는다)
 *
 * ★ 가짜 A 는 C 보다 나쁘다. 없는 성과를 있다고 적는 것이라 그 위 판단이 전부 틀어진다.
 *   실제로 ChatGPT 를 잰다고 해 놓고 구글 화면을 읽어, 광고 미리보기에 박힌
 *   내 도메인을 인용으로 세고 A 로 찍은 일이 있었다. 그래서 ①을 먼저 본다.
 *
 * ★ 이름으로 셀 때 짧은 조각을 쓰지 않는다. 한국어에서 두 글자 이름은 다른 말 안에 다 걸린다.
 *   도메인처럼 다른 말과 안 겹치는 것만 「나」 목록에 넣는다.
 *
 * 쓰는 법 · 설정 파일 하나를 읽는다. 경로는 환경변수 측정설정 으로 준다.
 *   {
 *     "엔진": "perplexity",
 *     "나": ["my-site.com"],                 ← 도메인처럼 안 겹치는 것만
 *     "질문": [{ "id": "slug-1", "질문": "…" }, …],
 *     "나온곳": "/절대경로/인용-perplexity.json"
 *   }
 */

import fs from "node:fs";

const 설정경로 = process.env.측정설정 || "/tmp/측정설정.json";
const 설정 = JSON.parse(fs.readFileSync(설정경로, "utf8"));
const 엔진 = 설정.엔진;
const 질의 = 설정.질문;
const 나 = 설정.나;
const 나온곳 = 설정.나온곳;
const fsWrite = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 1), "utf8");

/*
 * 집   지금 화면이 이 엔진 화면이 맞나. 안 맞으면 재지 않고 「못잼」이다.
 * 답표시  AI 답변 상자를 찾는 실마리. **화면에 글자로 보이는 말**을 쓴다.
 *       class 이름은 자주 바뀌는데 이 글자는 잘 안 바뀐다.
 * 펼치기  출처가 접혀 있는 엔진. 안 펼치면 뒤쪽 출처를 통째로 못 본다.
 */
const 엔진설정 = {
  perplexity: { 주소: () => "https://www.perplexity.ai/", 집: /perplexity\.ai/, 빼기: /perplexity\.(ai|com)|pplx\.ai/ },
  google: { 주소: (q) => "https://www.google.com/search?hl=ko&gl=kr&q=" + encodeURIComponent(q), 집: /google\./, 답표시: "AI 개요", 펼치기: true, 빼기: /google\.com|google\.co|gstatic|googleusercontent|schema\.org/ },
  naver: { 주소: (q) => "https://search.naver.com/search.naver?query=" + encodeURIComponent(q), 집: /naver\.com/, 답표시: "AI 브리핑", 빼기: /naver\.com|naver\.net|navercorp\.com|pstatic\.net/ },
  chatgpt: { 주소: () => "https://chatgpt.com/", 집: /chatgpt\.com/, 빼기: /openai\.com|chatgpt\.com/ },
};

const cfg = 엔진설정[엔진];
if (!cfg) {
  cliLog("모르는 엔진: " + 엔진 + " (perplexity · google · naver · chatgpt)");
} else if (!Array.isArray(나) || 나.some((u) => u.length < 6)) {
  cliLog("「나」 목록이 없거나 6글자 미만이 있다. 도메인처럼 안 겹치는 것만 넣는다.");
} else {
  await useOrCreateTaskSpace("AI 인용 측정");
  const 결과 = [];

  for (const q of 질의) {
    let 도메인 = [];
    let 글자 = "";
    try {
      if (엔진 === "perplexity" || 엔진 === "chatgpt") {
        await gotoAndWait(cfg.주소(), { timeout: 40, settle: 3 });
        await wait(엔진 === "chatgpt" ? 6 : 5);
        const 칸 = await js(String.raw`
          (() => {
            const c = [...document.querySelectorAll('textarea,[contenteditable="true"]')].filter(e => e.offsetParent)
            if (!c.length) return null
            const b = c[0].getBoundingClientRect()
            return { x: Math.round(b.left + b.width/2), y: Math.round(b.top + b.height/2) }
          })()
        `);
        if (!칸) { 결과.push({ id: q.id, 판정: "못잼", 왜: "입력칸 없음" }); continue; }
        if (엔진 === "chatgpt") {
          const 더하기 = await js(String.raw`
            (() => {
              const e = [...document.querySelectorAll('button')].find(x => x.offsetParent && /파일 등 추가/.test(x.getAttribute('aria-label')||''))
              if (!e) return null
              const r = e.getBoundingClientRect()
              return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) }
            })()
          `);
          if (더하기) {
            await click([더하기.x, 더하기.y]); await wait(2);
            const 웹 = await js(String.raw`
              (() => {
                const e = [...document.querySelectorAll('*')].find(x => x.offsetParent && (x.innerText||'').trim() === '웹 검색' && x.children.length === 0)
                if (!e) return null
                const r = e.getBoundingClientRect()
                return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) }
              })()
            `);
            if (웹) { await click([웹.x, 웹.y]); await wait(2); }
          }
        }
        await click([칸.x, 칸.y]); await wait(1);
        await typeText(q.질문); await wait(1);
        await pressKey("Enter");
        await wait(엔진 === "chatgpt" ? 22 : 16);
      } else {
        await gotoAndWait(cfg.주소(q.질문), { timeout: 40, settle: 3 });
        await wait(7);
      }

      /*
        ★ ① 지금 화면이 그 엔진 화면인가.

        딴 데로 튕겨 가 있으면 **그 화면의 글자를 읽어 인용으로 세게 된다.**
        실제로 ChatGPT 를 잰다고 해 놓고 구글 화면을 읽어, 광고 미리보기에 박힌
        내 도메인을 인용으로 세고 A 로 찍은 일이 있었다. **가짜 A 는 C 보다 나쁘다.**
      */
      const 여기 = await js(String.raw`
        (() => { try { return location.hostname.replace(/^www\./,'') } catch { return '' } })()
      `);
      if (cfg.집 && !cfg.집.test(여기 || "")) {
        결과.push({ id: q.id, 판정: "못잼", 왜: `${엔진} 화면이 아니라 ${여기 || "빈 곳"} 이었습니다` });
        cliLog("딴화면 " + q.id + " · " + (여기 || "빈 곳"));
        fsWrite(나온곳, 결과);
        continue;
      }

      /*
        ★ 출처가 접혀 있으면 펼친다.

        구글 AI 개요의 출처 카드는 접힌 채로 두세 개만 보인다. 「모두 표시」를 누르면
        나머지가 나온다 — 실측으로 2개가 8개가 됐다. **안 누르면 뒤쪽 출처를 못 본다.**
        그러면 실제로는 5위로 걸렸는데 「안 나옴」으로 적힌다.
      */
      if (cfg.펼치기) {
        const 펼침 = await js(String.raw`
          (() => {
            const e = [...document.querySelectorAll('div[role="button"],button,a')]
              .find(x => x.offsetParent && /모두 표시|더 보기|Show all|More/.test((x.innerText||'').trim()))
            if (!e) return null
            const r = e.getBoundingClientRect()
            return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) }
          })()
        `);
        if (펼침) { await click([펼침.x, 펼침.y]); await wait(4); }
      }

      /*
        ★ ② 답 상자를 찾았나.

        답표시가 있는 엔진은 **그 상자 안만** 본다. 화면 전체를 보면 검색 결과와
        광고까지 섞여 들어와 인용이 아닌 것을 인용으로 센다.

        상자를 못 찾으면 **화면이 바뀐 것**이다. C 가 아니라 못잼이다.
      */
      if (cfg.답표시) {
        const 상자있나 = await js(
          "(() => {" +
            "const 표시 = " + JSON.stringify(cfg.답표시) + ";" +
            "return [...document.querySelectorAll('h1,h2,h3,div,span,strong')]" +
              ".some(e => e.offsetParent && (e.innerText||'').trim() === 표시);" +
          "})()"
        );
        if (!상자있나) {
          결과.push({ id: q.id, 판정: "못잼", 왜: `화면에서 「${cfg.답표시}」를 못 찾았습니다 · 화면이 바뀌었거나 이 질문엔 안 떴습니다` });
          cliLog("상자없음 " + q.id);
          fsWrite(나온곳, 결과);
          continue;
        }
      }

      const 뽑기 = await js(
        "(() => {" +
          "const 빼기 = " + cfg.빼기.toString() + ";" +
          "const 밖 = [...document.querySelectorAll('a[href^=\"http\"]')].map(a => a.href).filter(h => !빼기.test(h));" +
          "const d = [];" +
          "for (const u of 밖) { try { const n = new URL(u).hostname.replace(/^www\\./,''); if (!d.includes(n)) d.push(n) } catch {} }" +
          "return { 도메인: d.slice(0, 20), 글자: document.body.innerText.slice(0, 4000) };" +
          "})()"
      );
      도메인 = 뽑기.도메인; 글자 = 뽑기.글자;

      // ChatGPT 는 출처를 링크가 아니라 버튼으로 낸다. 이름 앞에 파비콘 글자 한 자가 붙는다
      if (엔진 === "chatgpt") {
        도메인 = await js(String.raw`
          (() => {
            const 버림 = /^(로그인|새 채팅|채팅 검색|이미지|플러그인|심층 리서치|설정|도움말|무료로 회원가입|플랜 및 가격 보기|복사|공유|좋아요|싫어요|다시 생성|편집|웹 검색|모두 허용|비필수사항 거부|출처|더 보기|맨 아래로 스크롤)$/
            const out = []
            for (const b of document.querySelectorAll('button')) {
              if (!b.offsetParent) continue
              let t = (b.innerText||'').replace(/\s+/g,' ').replace(/\s*\+\d+$/,'').trim()
              for (let i = 0; i < 3; i++) t = t.replace(/^\S\s+(?=\S)/, '')
              t = t.trim()
              if (!t || t.length > 24 || 버림.test(t)) continue
              if (!out.includes(t)) out.push(t)
            }
            return out
          })()
        `);
      }
    } catch (e) {
      결과.push({ id: q.id, 판정: "못잼", 왜: String(e).slice(0, 80) });
      continue;
    }

    /*
      ★ ③ 출처를 하나도 못 뽑았으면 못잼이다. C 가 아니다.

      출처가 0개라는 건 「아무도 인용 안 됐다」가 아니라 대개 **읽는 법이 안 맞는다**는
      뜻이다. 화면이 바뀌었거나, 답이 웹을 안 뒤졌거나, 아직 안 그려졌거나.

      이걸 C 로 적으면 값이 조용히 0 으로 내려가고 아무도 원인을 모른다.
      **못 믿는 0 을 안 쌓는다.**
    */
    if (!도메인.length) {
      결과.push({ id: q.id, 판정: "못잼", 왜: "출처를 하나도 못 뽑았습니다 · 화면이 바뀌었거나 답이 웹을 안 뒤졌습니다" });
      cliLog("출처0 " + q.id);
      fsWrite(나온곳, 결과);
      continue;
    }

    const 자리 = 도메인.findIndex((d) => 나.some((u) => d.includes(u)));
    const 언급 = 나.some((u) => 글자.includes(u));
    const 판정 = 자리 >= 0 ? "A" : 언급 ? "B" : "C";
    결과.push({ id: q.id, 질문: q.질문, 엔진, 판정, 순위: 자리 >= 0 ? 자리 + 1 : null, 경쟁: 도메인.slice(0, 8), 잰때: new Date().toISOString() });
    cliLog(q.id + " " + 판정 + (자리 >= 0 ? " " + (자리 + 1) + "위" : "") + "  " + 도메인.slice(0, 3).join(" · "));
    fsWrite(나온곳, 결과);
  }

  const 셈 = (p) => 결과.filter((x) => x.판정 === p).length;
  cliLog("");
  cliLog("=== " + 엔진 + " 끝 · " + 결과.length + "개 ===");
  cliLog("A 출처로 걸림 " + 셈("A") + " · B 이름만 " + 셈("B") + " · C 안 나옴 " + 셈("C") + " · 못잼 " + 셈("못잼"));

  /*
    ★ 못잼이 많으면 그 판은 못 믿는다. 0 으로 세지 말고 다시 잰다.
    절반 넘게 못 읽었으면 그날 값이 아니라 **읽는 법이 안 맞는 것**이다.
  */
  if (셈("못잼") > 결과.length / 2) {
    cliLog("");
    cliLog("★ 절반 넘게 못 읽었습니다. 이 판을 0 으로 세지 마십시오.");
    cliLog("  화면이 바뀌었을 수 있습니다. 왜 칸을 보고 읽는 법을 고친 뒤 다시 재십시오.");
    const 왜들 = [...new Set(결과.filter((x) => x.판정 === "못잼").map((x) => x.왜))];
    for (const w of 왜들.slice(0, 4)) cliLog("  · " + w);
  }
  fsWrite(나온곳, 결과);
}
