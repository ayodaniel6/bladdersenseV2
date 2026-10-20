import { Component } from 'react'

// If a page ever crashes, say so and offer a reload, instead of a blank screen.
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('Page crashed:', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="notice notice--warning" role="alert">
        <h3>This page did not load properly.</h3>
        <p>Your diary is safe. Reloading usually fixes it.</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>Reload the page</button>
      </div>
    )
  }
}
