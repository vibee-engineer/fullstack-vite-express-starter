import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountMenu } from '../AccountMenu';

describe('AccountMenu', () => {
  it('renders nothing without an account', () => {
    const { container } = render(<AccountMenu account={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is not a button when there is no menu to open', () => {
    render(<AccountMenu account={{ name: 'Rhea Patel' }} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('RP')).toBeInTheDocument();
  });

  it('is a labelled button when there is a menu', () => {
    render(<AccountMenu account={{ name: 'Rhea Patel', menu: <div>Sign out</div> }} />);
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
  });
});
