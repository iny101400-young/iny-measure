#!/usr/bin/env bash
# iny-measure 설치
# 사용법:  bash install.sh [작업폴더경로]
#          경로를 안 주면 앞 단계에서 쓰던 폴더를 그대로 씁니다.
#
# 변수 이름은 영문만 씁니다. zsh 는 한글 변수를 받지만 bash 는 못 받고,
# bash -n 문법 검사는 통과해서 실행해야 잡힙니다.
set -e
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$HOME/.claude/iny-config.json"

# 앞 단계가 이미 잡아둔 작업 폴더를 그대로 씁니다. 덮어쓰면 앞 단계가 만든 것을 못 찾습니다.
EXISTING=""
if [ -f "$CONFIG" ]; then
  EXISTING="$(sed -n 's/.*"kb_path"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' "$CONFIG" | head -1)"
fi

KB_PATH="${1:-${EXISTING:-$HOME/asset-engine}}"
KB_PATH="${KB_PATH/#\~/$HOME}"

mkdir -p "$KB_PATH/outputs"
mkdir -p "$HOME/.claude"
cat > "$CONFIG" <<CFG
{
  "kb_path": "$KB_PATH"
}
CFG

DEST="$HOME/.claude/skills/iny-measure"
mkdir -p "$DEST"
cp "$SRC/SKILL.md" "$DEST/SKILL.md"
rm -rf "$DEST/scripts" "$DEST/references"
cp -R "$SRC/scripts" "$DEST/scripts"          # 색인확인 · 인용재기 · 거두기

echo
echo "설치됐습니다."
echo "  스킬      ~/.claude/skills/iny-measure/"
echo "  작업 폴더  $KB_PATH"

# 판단 근거 문서 · 04·05·06·07·08 이 함께 읽는 기준 한 장입니다.
# 원본은 저장소 하나에만 있고, 없으면 여기서 같이 받아옵니다.
GEO="$HOME/.claude/skills/iny-geo-기준"
if [ ! -f "$GEO/references/기준.md" ]; then
  echo
  echo "판단 근거 문서(iny-geo-기준)를 같이 받습니다."
  TMPGEO="$(mktemp -d)"
  if git clone -q --depth 1 https://github.com/iny101400-young/iny-geo.git "$TMPGEO/geo" 2>/dev/null; then
    mkdir -p "$GEO"
    cp "$TMPGEO/geo/SKILL.md" "$GEO/SKILL.md"
    rm -rf "$GEO/references"
    cp -R "$TMPGEO/geo/references" "$GEO/references"
    echo "  ~/.claude/skills/iny-geo-기준/ 에 깔렸습니다."
  else
    echo "  못 받았습니다. 인터넷이 막혔거나 git 이 없습니다."
    echo "  https://github.com/iny101400-young/iny-geo 에서 직접 받아"
    echo "  ~/.claude/skills/iny-geo-기준/ 에 두시면 됩니다."
  fi
  rm -rf "$TMPGEO"
fi

# 08 은 06 이 지은 질문으로 잽니다. 없으면 잴 것이 없습니다.
if [ ! -f "$KB_PATH/outputs/06-publish/질문.md" ]; then
  echo
  echo "다만 06 에서 지은 질문 파일이 안 보입니다."
  echo "08 은 그 질문으로 AI 답변을 잽니다. 06 을 먼저 돌리시는 게 맞습니다."
  echo "  https://github.com/iny101400-young/iny-publish"
  exit 0
fi

echo
echo "Claude Code 를 $KB_PATH 에서 열고 '08 시작' 이라고 치세요."
