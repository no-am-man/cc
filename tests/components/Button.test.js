import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../../src/components/Button';

describe('Button Component', () => {
  test('renders children correctly', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  test('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    fireEvent.click(screen.getByText('Click Me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('applies variant classes', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    expect(container.firstChild).toHaveClass('secondary');
  });

  test('defaults to primary variant', () => {
    const { container } = render(<Button>Primary</Button>);
    expect(container.firstChild).toHaveClass('primary');
  });
});

