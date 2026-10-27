import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Select } from '../../src/renderer/src/components/ui'

Element.prototype.scrollIntoView = vi.fn()
afterEach(cleanup)

const people = ['Shibu Dhara', 'Sumit Das', 'Subrata Das', 'Hardik Patel']

describe('searchable Select', () => {
  it('filters options by search text and picks with Enter', () => {
    const onChange = vi.fn()
    render(<Select id="p" value="" options={people} placeholder="Add a person" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    const search = screen.getByLabelText('Search options')
    fireEvent.change(search, { target: { value: 'das' } })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Sumit Das', 'Subrata Das'])
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('Subrata Das')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('picks with a click and shows "No matches" for unknown text', () => {
    const onChange = vi.fn()
    render(<Select id="p" value="Shibu Dhara" options={people} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByLabelText('Search options'), { target: { value: 'zzz' } })
    expect(screen.getByText('No matches')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search options'), { target: { value: 'hard' } })
    fireEvent.click(screen.getByRole('option', { name: 'Hardik Patel' }))
    expect(onChange).toHaveBeenCalledWith('Hardik Patel')
  })

  it('closes on Escape without changing the value and stays disabled when disabled', () => {
    const onChange = vi.fn()
    const { rerender } = render(<Select id="p" value="Sumit Das" options={people} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.keyDown(screen.getByLabelText('Search options'), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    rerender(<Select id="p" value="Sumit Das" options={people} onChange={onChange} disabled />)
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('opens upward when there is no room below but more room above', () => {
    render(<Select id="p" value="" options={people} placeholder="Pick" onChange={() => {}} />)
    const button = screen.getByRole('button')
    button.getBoundingClientRect = () => ({ top: 700, bottom: 736, left: 0, right: 200, width: 200, height: 36, x: 0, y: 700, toJSON: () => ({}) })
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
    fireEvent.click(button)
    expect(screen.getByRole('listbox').parentElement!.className).toContain('bottom-full')
  })

  it('opens downward when there is room below', () => {
    render(<Select id="p" value="" options={people} placeholder="Pick" onChange={() => {}} />)
    const button = screen.getByRole('button')
    button.getBoundingClientRect = () => ({ top: 100, bottom: 136, left: 0, right: 200, width: 200, height: 36, x: 0, y: 100, toJSON: () => ({}) })
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
    fireEvent.click(button)
    expect(screen.getByRole('listbox').parentElement!.className).toContain('top-full')
  })
})
