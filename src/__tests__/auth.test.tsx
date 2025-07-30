import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import Login from '../pages/login';
import { authService } from '../lib/supabase-secure';

// Mock the auth service
jest.mock('../lib/supabase-secure', () => ({
  authService: {
    signIn: jest.fn(),
    isAdmin: jest.fn(),
  },
  userService: {
    updateLastLogin: jest.fn(),
  },
}));

// Mock useRouter
const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('Login Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders login form', () => {
    render(<Login />);
    
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('handles successful login for regular user', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    (authService.signIn as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    (authService.isAdmin as jest.Mock).mockResolvedValue(false);

    render(<Login />);
    
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('handles successful login for admin user', async () => {
    const mockUser = { id: '1', email: 'admin@example.com' };
    (authService.signIn as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    (authService.isAdmin as jest.Mock).mockResolvedValue(true);

    render(<Login />);
    
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/dashboard');
    });
  });

  test('displays error message on login failure', async () => {
    (authService.signIn as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials' },
    });

    render(<Login />);
    
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  test('disables form during submission', async () => {
    (authService.signIn as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ data: null, error: null }), 1000))
    );

    render(<Login />);
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
  });
}); 