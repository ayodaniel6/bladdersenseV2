import { Link, Navigate, useParams } from 'react-router'
import { guideSections } from '../content/guide.js'
import { useSession } from '../lib/session.jsx'
import { useTitle } from '../lib/useTitle.js'

function Block({ block }) {
  switch (block.type) {
    case 'paragraph': return <p>{block.text}</p>
    case 'heading': return <h3>{block.text}</h3>
    case 'list': return <ul>{block.items.map((t) => <li key={t}>{t}</li>)}</ul>
    case 'checklist': return <ul className="checklist">{block.items.map((t) => <li key={t}>{t}</li>)}</ul>
    case 'tip': return <div className="notice notice--neutral"><p>{block.text}</p></div>
    default: return null
  }
}

export default function GuideSection() {
  const { id } = useParams()
  const { status } = useSession()
  const index = guideSections.findIndex((s) => s.id === id)
  const section = guideSections[index]
  useTitle(section?.title)
  if (!section) return <Navigate to="/guide" replace />
  const next = guideSections[index + 1]

  return (
    <article className="stack">
      <div>
        <p className="small"><Link to="/guide">The guide</Link> · Section {index + 1} of {guideSections.length}</p>
        <h1>{section.title}</h1>
      </div>
      <p className="key-message">{section.content.keyMessage}</p>
      <div className="prose">
        {section.content.body.map((b, i) => <Block key={i} block={b} />)}
      </div>
      <div className="card card--tint">
        {status === 'in' ? (
          <p style={{ marginBottom: 0 }}>Trying a change? Keep logging each morning, then check <Link to="/patterns">your patterns</Link> after a week or two.</p>
        ) : (
          <p style={{ marginBottom: 0 }}>A diary shows which changes help you. <Link to="/sign-in">Start yours</Link>; it takes a minute a morning.</p>
        )}
      </div>
      {next && <Link className="btn btn--secondary btn--block" to={`/guide/${next.id}`}>Next: {next.title}</Link>}
    </article>
  )
}
