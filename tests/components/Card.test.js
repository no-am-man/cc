import React from 'react';
import { render, screen } from '@testing-library/react';
import Card from '../../src/components/Card';

describe('Card Component', () => {
  test('renders title and children correctly', () => {
    render(
      <Card title="Test Title">
        <p>Card Content</p>
      </Card>
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });
});

