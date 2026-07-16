export type MensajeRole = 'user' | 'assistant';

export function MensajeChat({ role, text }: { role: MensajeRole; text: string }) {
  return (
    <article className={'mia-msg mia-msg-' + role}>
      <p>{text}</p>
    </article>
  );
}
