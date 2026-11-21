/**
 * Contact form on /lien-he. EzySupport's public endpoint answers 204 with an empty body on success and
 * reports validation problems as a JSON field map with status 200 (some builds) or 400 — so the result is
 * judged on both the HTTP status and the parsed body, never on `res.ok` alone.
 */
type Field = 'contactUsYourName' | 'contactUsYourEmail' | 'contactUsSubject' | 'contactUsMessage';

const FIELD_LABELS: Record<Field, string> = {
  contactUsYourName: 'Họ tên',
  contactUsYourEmail: 'Email',
  contactUsSubject: 'Tiêu đề',
  contactUsMessage: 'Nội dung',
};

const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
const status = form?.querySelector<HTMLElement>('[data-contact-status]');
const button = form?.querySelector<HTMLButtonElement>('button[type="submit"]');

if (form && status && button) {
  const show = (text: string, tone: 'pending' | 'ok' | 'error') => {
    status.textContent = text;
    status.dataset.tone = tone;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      show('Vui lòng điền đủ họ tên, email, tiêu đề và nội dung.', 'error');
      return;
    }
    const data = Object.fromEntries(new FormData(form)) as Record<Field, string>;
    button.disabled = true;
    show('Đang gửi lời nhắn…', 'pending');
    try {
      const response = await fetch('/api/v1/contact-us', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          contactUsYourName: data.contactUsYourName?.trim(),
          contactUsYourEmail: data.contactUsYourEmail?.trim(),
          contactUsSubject: data.contactUsSubject?.trim(),
          contactUsMessage: data.contactUsMessage?.trim(),
        }),
      });
      const text = (await response.text()).trim();
      if ((response.status === 204 || response.ok) && !text) {
        form.reset();
        show('Đã gửi. Mình sẽ phản hồi qua email trong 1–2 ngày làm việc.', 'ok');
        return;
      }
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        const errors = Object.entries(body as Record<string, string>)
          .map(([field, reason]) => {
            const label = FIELD_LABELS[field as Field];
            if (!label) return null;
            const detail =
              reason === 'required' ? 'bắt buộc' : reason === 'invalid' ? 'chưa hợp lệ' : reason;
            return `${label} ${detail}`;
          })
          .filter(Boolean);
        if (errors.length) {
          show(`Chưa gửi được: ${errors.join('; ')}.`, 'error');
          return;
        }
      }
      show(`Chưa gửi được (mã ${response.status}). Bạn thử lại hoặc nhắn Zalo bên dưới.`, 'error');
    } catch {
      show('Mất kết nối khi gửi. Bạn thử lại hoặc nhắn Zalo bên dưới.', 'error');
    } finally {
      button.disabled = false;
    }
  });
}
