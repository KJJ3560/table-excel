"""Gmail SMTP를 이용해 리포트를 이메일로 발송한다."""

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from pathlib import Path

import pandas as pd

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465

ENV_SENDER = "REPORT_GMAIL_ADDRESS"
ENV_APP_PASSWORD = "REPORT_GMAIL_APP_PASSWORD"
ENV_RECIPIENT = "REPORT_RECIPIENT_EMAIL"


def build_summary_text(market_frames: dict[str, pd.DataFrame], movers_top_n: int = 5) -> str:
    """이메일 본문에 넣을 시장별 상승/하락 요약 텍스트를 만든다."""
    lines: list[str] = []
    for market, df in market_frames.items():
        lines.append(f"[{market}] 외국인 지분율 상위 {len(df)}종목")
        movers = df.dropna(subset=["ratio_change"]).sort_values("ratio_change", ascending=False)
        if movers.empty:
            lines.append("  (비교할 전일 데이터가 없어 변동률을 계산하지 않았습니다)")
            lines.append("")
            continue

        lines.append("  ▲ 지분율 상승 TOP:")
        for _, row in movers.head(movers_top_n).iterrows():
            lines.append(_format_mover_line(row))

        lines.append("  ▼ 지분율 하락 TOP:")
        for _, row in movers.tail(movers_top_n).iloc[::-1].iterrows():
            lines.append(_format_mover_line(row))

        if "recent_disclosures" in df.columns:
            disclosures = df[df["recent_disclosures"].fillna("") != ""]
        else:
            disclosures = df.iloc[0:0]
        if not disclosures.empty:
            lines.append("  ℹ 최근 지분공시(DART):")
            for _, row in disclosures.iterrows():
                lines.append(f"    {row['name']}({row['ticker']}): {row['recent_disclosures']}")

        lines.append("")
    return "\n".join(lines)


def _format_mover_line(row: pd.Series) -> str:
    return (
        f"    {row['name']}({row['ticker']}) {row['foreign_ratio']:.2f}% "
        f"({row['ratio_change']:+.2f}%p, 현재 {int(row['rank'])}위)"
    )


def send_email_report(subject: str, body: str, attachment_path: Path) -> None:
    """환경변수에 설정된 발신/수신 정보로 리포트 이메일을 발송한다.

    필요 환경변수: REPORT_GMAIL_ADDRESS, REPORT_GMAIL_APP_PASSWORD, REPORT_RECIPIENT_EMAIL
    (Gmail은 일반 비밀번호가 아닌 앱 비밀번호를 사용해야 한다)
    """
    sender = _require_env(ENV_SENDER)
    password = _require_env(ENV_APP_PASSWORD)
    recipient = _require_env(ENV_RECIPIENT)

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = recipient
    message.set_content(body)

    attachment_path = Path(attachment_path)
    message.add_attachment(
        attachment_path.read_bytes(),
        maintype="application",
        subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=attachment_path.name,
    )

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as smtp:
        smtp.login(sender, password)
        smtp.send_message(message)


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"환경변수 {name}가 설정되어 있지 않습니다. 이메일 발송에 필요합니다.")
    return value
