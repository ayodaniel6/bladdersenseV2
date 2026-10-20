import { Link } from 'react-router'
import { guideSections } from '../content/guide.js'
import { useTitle } from '../lib/useTitle.js'

export default function Guide() {
  useTitle('The guide')
  return (
    <div className="stack">
      <div>
        <h1>The guide</h1>
        <p className="lede">Managing the everyday factors that affect bladder control: fluids, sleep, activity and stress. {guideSections.length} short sections; read them in any order.</p>
      </div>
      <ul className="guide-list">
        {guideSections.map((s) => (
          <li key={s.id}>
            <Link to={`/guide/${s.id}`}>
              <strong>{s.title}</strong>
              <span>{s.shortDesc}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
