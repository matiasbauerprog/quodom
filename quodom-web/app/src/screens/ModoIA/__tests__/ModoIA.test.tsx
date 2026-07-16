import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModoIA } from '../ModoIA';
import { iaApi } from '../../../api/ia';

vi.mock('../../../api/ia', () => ({
  iaApi: { chat: vi.fn() }
}));

function renderWith() {
  return render(<MemoryRouter><ModoIA /></MemoryRouter>);
}

describe('ModoIA (base chat)', () => {
  beforeEach(() => { (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockReset(); });

  it('renders the hardcoded welcome message on mount', () => {
    renderWith();
    expect(screen.getByText(/contame tu proyecto/i)).toBeInTheDocument();
  });

  it('disables the send button when input is empty or busy', () => {
    renderWith();
    const send = screen.getByRole('button', { name: /enviar/i });
    expect(send).toBeDisabled();

    const input = screen.getByPlaceholderText(/escrib/i);
    fireEvent.change(input, { target: { value: 'hola' } });
    expect(send).toBeEnabled();
  });

  it('sends the message and renders the assistant reply', async () => {
    (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ type: 'question', text: '¿de qué color?' });
    renderWith();

    const input = screen.getByPlaceholderText(/escrib/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'quiero pintar' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(screen.getByText('¿de qué color?')).toBeInTheDocument());
    expect(screen.getByText('quiero pintar')).toBeInTheDocument();
    expect(iaApi.chat).toHaveBeenCalledWith([{ role: 'user', text: 'quiero pintar' }]);
  });

  it('renders backend errors as an assistant bubble', async () => {
    const err = new Error('Alcanzaste el límite diario.');
    (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(err);
    renderWith();

    const input = screen.getByPlaceholderText(/escrib/i);
    fireEvent.change(input, { target: { value: 'hola' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(screen.getByText(/alcanzaste el límite/i)).toBeInTheDocument());
  });
});
