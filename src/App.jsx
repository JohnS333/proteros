import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'proteros.eisenhowerDashboard.v1'

const columns = [
  { name: 'Must do', short: 'Must' },
  { name: 'Should do', short: 'Should' },
  { name: "It'd be nice to do", short: 'Nice' },
]

const rows = [
  { name: 'Urgent' },
  { name: 'Not urgent' },
]

const emptyTask = {
  title: '',
  notes: '',
  dueDate: '',
  column: 0,
  row: 0,
  color: '#78d5ff',
}

function LogoMark({ size = 34 }) {
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Proteros logo"
    >
      <defs>
        <linearGradient id="proteros-mark" x1="7" y1="5" x2="41" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d7fff1" />
          <stop offset="1" stopColor="#62cdb1" />
        </linearGradient>
      </defs>
      <path className="logo-frame" d="M24 2.8 43.1 13.4v21.2L24 45.2 4.9 34.6V13.4L24 2.8Z" />
      <path fill="url(#proteros-mark)" d="m12.2 12.5 11.8-6.6 11.8 6.6-5.3 2.9-6.5-3.6-6.5 3.6-5.3-2.9Z" />
      <path fill="url(#proteros-mark)" d="M12.2 12.5v13.2l5.3 2.9V15.4l-5.3-2.9Z" />
      <path fill="url(#proteros-mark)" d="m17.5 28.6 6.5 3.6 6.5-3.6v-6.1l-6.5 3.6-6.5-3.6v6.1Z" />
      <path fill="url(#proteros-mark)" d="m30.5 15.4 5.3-2.9v13.2l-5.3 2.9V15.4Z" />
      <path className="logo-glint" d="m24 12.4 6.5 3.6-6.5 3.6-6.5-3.6 6.5-3.6Z" />
    </svg>
  )
}

function createTask(values) {
  return {
    ...values,
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    createdAt: new Date().toISOString(),
  }
}

function App() {
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      return Array.isArray(saved) ? saved : []
    } catch {
      return []
    }
  })
  const [form, setForm] = useState(emptyTask)
  const [editingId, setEditingId] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  const urgentCount = useMemo(
    () => tasks.filter((task) => task.row === 0).length,
    [tasks],
  )

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: ['column', 'row'].includes(name) ? Number(value) : value,
    }))
  }

  function resetForm() {
    setForm(emptyTask)
    setEditingId(null)
  }

  function submitTask(event) {
    event.preventDefault()
    if (!form.title.trim()) {
      setMessage('Give your task a title first.')
      return
    }

    if (editingId) {
      setTasks((current) =>
        current.map((task) =>
          task.id === editingId ? { ...task, ...form, title: form.title.trim() } : task,
        ),
      )
      setMessage('Task updated.')
    } else {
      setTasks((current) => [...current, createTask({ ...form, title: form.title.trim() })])
      setMessage('Task added to your matrix.')
    }
    resetForm()
  }

  function editTask(task) {
    setForm({
      title: task.title,
      notes: task.notes || '',
      dueDate: task.dueDate || '',
      column: task.column,
      row: task.row,
      color: task.color || '#78d5ff',
    })
    setEditingId(task.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function deleteTask(id) {
    setTasks((current) => current.filter((task) => task.id !== id))
    if (editingId === id) resetForm()
    setMessage('Task removed.')
  }

  function exportTasks() {
    const blob = new Blob([JSON.stringify({ version: 1, tasks }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'proteros-tasks.json'
    link.click()
    URL.revokeObjectURL(url)
    setMessage('Your task list was exported.')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Proteros home">
          <LogoMark />
          <span>PROTEROS</span>
        </a>
        <nav className="nav-actions" aria-label="Primary navigation">
          <a href="#matrix">Matrix</a>
          <a href="#about">About</a>
        </nav>
      </header>

      <main className="page">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Priority dashboard</p>
            <h1>Perfect Prioritization</h1>
            <p className="intro">
              A clearer way to sort your work across urgency and importance.
              Put every task in its place, then you get the next best move.
            </p>
            <div className="stats">
              <div><span>Total tasks</span><strong>{tasks.length}</strong></div>
              <div><span>Urgent tasks</span><strong>{urgentCount}</strong></div>
              <div className="data-location">
                <div><span>Where Your Data is</span><strong className="saved">Saved locally on Browser</strong></div>
                <button className="export-button" type="button" onClick={exportTasks}>Export (JSON)</button>
              </div>
            </div>
          </div>

          <section className="task-panel" aria-labelledby="task-form-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Task capture</p>
                <h2 id="task-form-title">{editingId ? 'Edit task' : 'Add a task'}</h2>
              </div>
              {editingId && <button className="text-button" type="button" onClick={resetForm}>Cancel</button>}
            </div>
            <form onSubmit={submitTask}>
              <label>
                Title
                <input name="title" value={form.title} onChange={updateField} placeholder="What needs your attention?" maxLength="120" />
              </label>
              <label>
                Notes
                <textarea name="notes" value={form.notes} onChange={updateField} placeholder="Context, links, or next steps" rows="2" />
              </label>
              <div className="form-grid">
                <label>Priority
                  <select name="column" value={form.column} onChange={updateField}>
                    {columns.map((column, index) => <option value={index} key={column.name}>{column.name}</option>)}
                  </select>
                </label>
                <label>Urgency
                  <select name="row" value={form.row} onChange={updateField}>
                    {rows.map((row, index) => <option value={index} key={row.name}>{row.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="form-grid">
                <label>Due date
                  <input name="dueDate" type="date" value={form.dueDate} onChange={updateField} />
                </label>
                <label>Color
                  <input className="color-input" name="color" type="color" value={form.color} onChange={updateField} />
                </label>
              </div>
              <div className="form-actions">
                <button className="primary-button" type="submit">{editingId ? 'Update task' : 'Add task'}</button>
                <button className="secondary-button" type="button" onClick={resetForm}>Clear</button>
              </div>
              {message && <p className="form-message" role="status">{message}</p>}
            </form>
          </section>
        </section>

        <section className="board-panel" id="matrix" aria-labelledby="matrix-title">
          <div className="board-heading">
            <div>
              <h2 id="matrix-title">Advanced Eisenhower Matrix</h2>
            </div>
            <p className="board-hint">Drag the noise out of your head and into a plan.</p>
          </div>
          <div className="matrix-shell">
            <div className="matrix-axis matrix-axis-importance" aria-label="Importance">
              <span className="matrix-axis-arrow" aria-hidden="true">←</span>
              <strong>Importance</strong>
            </div>
            <div className="matrix-axis matrix-axis-urgency" aria-label="Urgency">
              <span className="matrix-axis-arrow" aria-hidden="true">↑</span>
              <strong>Urgency</strong>
            </div>
            <div className="matrix">
              <div className="matrix-corner" />
              {columns.map((column) => <div className="column-label" key={column.name}><span>{column.short}</span><strong>{column.name.replace('', '')}</strong></div>)}
              {rows.map((row, rowIndex) => (
                <div className="matrix-row" key={row.name}>
                  <div className="row-label"><strong>{row.name}</strong><span>{row.description}</span></div>
                  {columns.map((column, columnIndex) => {
                    const cellTasks = tasks.filter((task) => task.row === rowIndex && task.column === columnIndex)
                    return (
                      <div className={`matrix-cell cell-${rowIndex}-${columnIndex}`} key={column.name}>
                        {cellTasks.map((task) => (
                          <article className="task-card" style={{ '--task-color': task.color }} key={task.id}>
                            <div className="task-card-top">
                              <span className="task-dot" />
                              <span className="task-category">{column.short}</span>
                              <button type="button" onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.title}`}>×</button>
                            </div>
                            <h3>{task.title}</h3>
                            {task.notes && <p>{task.notes}</p>}
                            {task.dueDate && <time dateTime={task.dueDate}>Due {task.dueDate}</time>}
                            <button className="edit-link" type="button" onClick={() => editTask(task)}>Edit task</button>
                          </article>
                        ))}
                        {cellTasks.length === 0 && <span className="empty-cell">Double Click to add task</span>}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="about-strip" id="about">
          <p className="eyebrow">The Proteros method</p>
          <h2>Urgency is a signal, not a strategy.</h2>
          <p>Use the matrix to protect deep work, schedule important plans, and make room for the work that moves you forward.</p>
        </section>
      </main>
      <footer>PROTEROS <span>— your next right move</span></footer>
    </div>
  )
}

export default App
