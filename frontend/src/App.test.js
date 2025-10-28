import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('renders SmartHardware brand in header', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );

  const brandButton = screen.getByRole('button', { name: /SmartHardware/i });
  expect(brandButton).toBeInTheDocument();
  expect(screen.getByText(/Future-proof hardware hub/i)).toBeInTheDocument();
});
