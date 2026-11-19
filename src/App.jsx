import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import eisenhowerMatrixSquare from './assets/EisenhowerMatrixSquare.jpg'

const STORAGE_KEY = 'proteros.eisenhowerDashboard.v1'

const columns = [
  { name: 'Must do', short: 'Must' },
  { name: 'Should do', short: 'Should' },
  { name: "It'd be nice to do", short: 'Nice' },
]

const rows = [
  { name: 'Urgent', timeframes: ['1 Day', '1 Wk', '2 Wk', '3 Wk', '1 Mth'] },
  { name: 'Not urgent', timeframes: [] },
]

const MAX_COORDINATE = 49

const COMPLETION_CATEGORY_ORDER = [
  { row: 0, column: 0, label: 'Urgent × Must do' },
  { row: 0, column: 1, label: 'Urgent × Should do' },
  { row: 1, column: 0, label: 'Not urgent × Must do' },
  { row: 0, column: 2, label: "Urgent × It'd be nice" },
  { row: 1, column: 1, label: 'Not urgent × Should do' },
  { row: 1, column: 2, label: "Not urgent × It'd be nice" },
]

// Tunable coefficients for the "Urgent × Must do" elliptical band order.
// They make (X=38, Y=3) and (X=7, Y=16) equal:
// 31*urgency(46) + 13*importance(11) =
// 31*urgency(33) + 13*importance(42)
const URGENT_MUST_PRIORITY = {
  urgencyWeight: 31,
  importanceWeight: 13,
  bandCount: 8,
}

const emptyTask = {
  title: '',
  notes: '',
  dueDate: '',
  column: 0,
  row: 0,
  x: 25,
  y: 25,
  color: '#78d5ff',
}

function parseDueDate(value) {
  if (!value) return null

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) {
    const [, year, month, day] = dateOnly
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateTimeLocal(value) {
  const date = parseDueDate(value)
  if (!date) return ''

  const pad = (part) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function dueDateFromY(y, now = new Date()) {
  const coordinate = Math.max(0, Math.min(MAX_COORDINATE, Number(y) || 0))

  if (coordinate <= 10) {
    const date = new Date(now)
    date.setMinutes(0, 0, 0)
    date.setHours(date.getHours() + Math.round((coordinate / 10) * 24))
    return date.toISOString()
  }

  let days
  if (coordinate <= 20) {
    days = 1 + ((coordinate - 10) / 10) * 6
  } else if (coordinate <= 30) {
    days = 7 + ((coordinate - 20) / 10) * 7
  } else if (coordinate <= 40) {
    days = 14 + ((coordinate - 30) / 10) * 7
  } else {
    days = 21 + ((coordinate - 40) / 9) * 9
  }

  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + Math.round(days))
  return date.toISOString()
}

function yFromDueDate(value, now = new Date()) {
  const dueDate = parseDueDate(value)
  if (!dueDate) return 25

  const nowTimestamp = now instanceof Date ? now.getTime() : now
  const hoursUntilDue = (dueDate.getTime() - nowTimestamp) / (60 * 60 * 1000)
  if (hoursUntilDue <= 0) return 0
  if (hoursUntilDue <= 24) return Math.round((hoursUntilDue / 24) * 10)

  const daysUntilDue = hoursUntilDue / 24
  if (daysUntilDue <= 7) return Math.round(10 + ((daysUntilDue - 1) / 6) * 10)
  if (daysUntilDue <= 14) return Math.round(20 + ((daysUntilDue - 7) / 7) * 10)
  if (daysUntilDue <= 21) return Math.round(30 + ((daysUntilDue - 14) / 7) * 10)
  if (daysUntilDue <= 30) return Math.round(40 + ((daysUntilDue - 21) / 9) * 9)
  return MAX_COORDINATE
}

function taskY(task, now) {
  if (task.row === 0 && task.dueDate) return yFromDueDate(task.dueDate, now)
  return Number.isInteger(task.y) ? task.y : 25
}

function urgentMustPriority(task) {
  const x = Math.max(0, Math.min(MAX_COORDINATE, Number(task.x) || 25))
  const y = Math.max(0, Math.min(MAX_COORDINATE, taskY(task, new Date())))
  const importance = MAX_COORDINATE - x
  const urgency = MAX_COORDINATE - y

  return (
    URGENT_MUST_PRIORITY.urgencyWeight * urgency +
    URGENT_MUST_PRIORITY.importanceWeight * importance
  )
}

function urgencyImportanceBand(task) {
  const score = urgentMustPriority(task)
  const maximum = (
    URGENT_MUST_PRIORITY.urgencyWeight +
    URGENT_MUST_PRIORITY.importanceWeight
  ) * MAX_COORDINATE
  const index = Math.min(
    URGENT_MUST_PRIORITY.bandCount - 1,
    Math.floor((score / maximum) * URGENT_MUST_PRIORITY.bandCount),
  )
  return URGENT_MUST_PRIORITY.bandCount - index
}

function taskCoordinate(task, now) {
  return {
    x: Number.isInteger(task.x) ? task.x : 25,
    y: taskY(task, now),
  }
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
  const [captureModal, setCaptureModal] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const dragFrame = useRef(null)
  const activeDrag = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const urgentCount = useMemo(
    () => tasks.filter((task) => task.row === 0).length,
    [tasks],
  )

  const completionSections = useMemo(() => {
    return COMPLETION_CATEGORY_ORDER.map((category) => {
      const categoryTasks = tasks.filter(
        (task) => task.row === category.row && task.column === category.column,
      )

      if (category.row === 0 && category.column === 0) {
        const sorted = [...categoryTasks].sort((a, b) => {
          const priorityDifference = urgentMustPriority(b) - urgentMustPriority(a)
          if (priorityDifference !== 0) return priorityDifference

          const aCoordinates = taskCoordinate(a, new Date(currentTime))
          const bCoordinates = taskCoordinate(b, new Date(currentTime))
          const ellipticDifference =
            (aCoordinates.x / MAX_COORDINATE) ** 2 +
            (aCoordinates.y / MAX_COORDINATE) ** 2 -
            ((bCoordinates.x / MAX_COORDINATE) ** 2 +
              (bCoordinates.y / MAX_COORDINATE) ** 2)
          if (ellipticDifference !== 0) return ellipticDifference
          return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
        })

        const bandedTasks = []
        let previousBand = null
        sorted.forEach((task) => {
          const band = urgencyImportanceBand(task)
          if (band !== previousBand) {
            bandedTasks.push({ type: 'separator', band, key: `band-${band}-${category.label}` })
            previousBand = band
          }
          bandedTasks.push({ type: 'task', task, key: task.id })
        })
        return { ...category, items: bandedTasks }
      }

      const sorted = [...categoryTasks].sort((a, b) => {
        const aCoordinates = taskCoordinate(a, new Date(currentTime))
        const bCoordinates = taskCoordinate(b, new Date(currentTime))
        const urgencyDifference = bCoordinates.y - aCoordinates.y
        if (category.row === 1) {
          const importanceDifference = bCoordinates.x - aCoordinates.x
          if (category.column === 0 && importanceDifference !== 0) return -importanceDifference
        }
        if (urgencyDifference !== 0) return urgencyDifference
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
      })

      return {
        ...category,
        items: sorted.map((task) => ({ type: 'task', task, key: task.id })),
      }
    })
  }, [tasks, currentTime])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: ['column', 'row'].includes(name) ? Number(value) : value,
      ...(name === 'dueDate' && value && current.row === 0
        ? { y: yFromDueDate(value) }
        : {}),
    }))
  }

  function resetForm() {
    setForm(emptyTask)
    setEditingId(null)
    setCaptureModal(null)
    setMessage('')
  }

  function submitTask(event) {
    event.preventDefault()
    if (!form.title.trim()) {
      setMessage('Give your task a title first.')
      return
    }

    const dueDate = form.dueDate
      ? new Date(form.dueDate).toISOString()
      : dueDateFromY(form.y)
    const values = {
      ...form,
      dueDate,
      y: form.row === 0 ? yFromDueDate(dueDate) : form.y,
      title: form.title.trim(),
    }

    if (editingId) {
      setTasks((current) =>
        current.map((task) =>
          task.id === editingId ? { ...task, ...values } : task,
        ),
      )
      setMessage('Task updated.')
    } else {
      setTasks((current) => [...current, createTask(values)])
      setMessage('Task added to your matrix.')
    }
    resetForm()
  }

  function editTask(task) {
    setForm({
      title: task.title,
      notes: task.notes || '',
      dueDate: formatDateTimeLocal(task.dueDate || dueDateFromY(task.y)),
      column: task.column,
      row: task.row,
      x: Number.isInteger(task.x) ? task.x : 25,
      y: taskY(task, currentTime),
      color: task.color || '#78d5ff',
    })
    setEditingId(task.id)
    setCaptureModal({
      open: true,
      left: Math.max(12, Math.min(window.innerWidth - 380, window.innerWidth / 2 - 180)),
      top: Math.max(12, Math.min(window.innerHeight - 520, window.innerHeight / 2 - 260)),
      column: task.column,
      row: task.row,
    })
  }

  function openCaptureModal(event, rowIndex, columnIndex) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(49, Math.round(((event.clientX - bounds.left) / bounds.width) * 49)))
    const y = Math.max(0, Math.min(49, Math.round(((event.clientY - bounds.top) / bounds.height) * 49)))
    const modalWidth = 360
    const modalHeight = 500
    const left = Math.max(12, Math.min(window.innerWidth - modalWidth - 12, event.clientX + 10))
    const top = Math.max(12, Math.min(window.innerHeight - modalHeight - 12, event.clientY + 10))

    setEditingId(null)
    setMessage('')
    setForm({
      ...emptyTask,
      column: columnIndex,
      row: rowIndex,
      x,
      y,
      dueDate: formatDateTimeLocal(dueDateFromY(y)),
    })
    setCaptureModal({ open: true, left, top, column: columnIndex, row: rowIndex, x, y })
  }

  function deleteTask(id) {
    setTasks((current) => current.filter((task) => task.id !== id))
    if (editingId === id) resetForm()
    setMessage('Task removed.')
  }

  function startTaskDrag(event, task) {
    if (event.button !== 0 || event.target.closest('button')) return

    event.preventDefault()
    event.stopPropagation()
    activeDrag.current = { id: task.id }
    setDraggingId(task.id)

    const moveTask = (moveEvent) => {
      if (!activeDrag.current) return
      if (dragFrame.current) cancelAnimationFrame(dragFrame.current)

      dragFrame.current = requestAnimationFrame(() => {
        const targetCell = Array.from(document.querySelectorAll('.matrix-cell')).find((cell) => {
          const bounds = cell.getBoundingClientRect()
          return moveEvent.clientX >= bounds.left &&
            moveEvent.clientX <= bounds.right &&
            moveEvent.clientY >= bounds.top &&
            moveEvent.clientY <= bounds.bottom
        })

        if (!targetCell) return

        const bounds = targetCell.getBoundingClientRect()
        const x = Math.max(0, Math.min(49, Math.round(((moveEvent.clientX - bounds.left) / bounds.width) * 49)))
        const y = Math.max(0, Math.min(49, Math.round(((moveEvent.clientY - bounds.top) / bounds.height) * 49)))
        const row = Number(targetCell.dataset.row)
        const column = Number(targetCell.dataset.column)

        setTasks((current) =>
          current.map((item) =>
            item.id === activeDrag.current?.id
              ? {
                ...item,
                x,
                y,
                row,
                column,
                dueDate: row === 0 ? dueDateFromY(y) : item.dueDate,
              }
              : item,
          ),
        )
      })
    }

    const stopTaskDrag = () => {
      if (dragFrame.current) cancelAnimationFrame(dragFrame.current)
      activeDrag.current = null
      setDraggingId(null)
      window.removeEventListener('pointermove', moveTask)
      window.removeEventListener('pointerup', stopTaskDrag)
      window.removeEventListener('pointercancel', stopTaskDrag)
    }

    window.addEventListener('pointermove', moveTask)
    window.addEventListener('pointerup', stopTaskDrag)
    window.addEventListener('pointercancel', stopTaskDrag)
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
        </section>

        <div className="priority-dashboard">
        <section className="board-panel" id="matrix" aria-labelledby="matrix-title">
          <div className="board-heading">
            <div>
              <h2 id="matrix-title">Advanced Eisenhower Matrix</h2>
            </div>
          </div>
          <div className="matrix-content">
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
                    <div className="row-label">
                      <strong>{row.name}</strong>
                      {row.timeframes.length > 0 && (
                        <div className="urgency-timescale" aria-label="Urgency time frame">
                          {row.timeframes.map((timeframe) => (
                            <span key={timeframe}>{timeframe}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {columns.map((column, columnIndex) => {
                      const cellTasks = tasks.filter((task) => task.row === rowIndex && task.column === columnIndex)
                      return (
                        <div
                          className={`matrix-cell cell-${rowIndex}-${columnIndex}`}
                          key={column.name}
                          data-row={rowIndex}
                          data-column={columnIndex}
                          style={rowIndex === 0 && columnIndex === 0
                            ? { '--eisenhower-grid': `url("${eisenhowerMatrixSquare}")` }
                            : undefined}
                          onDoubleClick={(event) => openCaptureModal(event, rowIndex, columnIndex)}
                        >
                          {cellTasks.map((task) => (
                            <article
                              className={`task-card${draggingId === task.id ? ' is-dragging' : ''}`}
                              style={{
                                '--task-color': task.color,
                                '--task-x': `${((Number.isInteger(task.x) ? task.x : 25) / 49) * 100}%`,
                                '--task-y': `${(taskY(task, currentTime) / MAX_COORDINATE) * 100}%`,
                              }}
                              key={task.id}
                              onPointerDown={(event) => startTaskDrag(event, task)}
                              onDoubleClick={(event) => event.stopPropagation()}
                              title="Drag task on the matrix"
                            >
                              <h3>{task.title}</h3>
                              <button
                                className="edit-link"
                                type="button"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  editTask(task)
                                }}
                                aria-label={`Edit ${task.title}`}
                                title={`Edit ${task.title}`}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M4 20h4l10.7-10.7a2 2 0 0 0-4-4L4 16v4Zm12.7-13.3 2.6 2.6" />
                                </svg>
                              </button>
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
          </div>
        </section>

        <aside className="completion-list" aria-labelledby="completion-title">
              <div className="completion-heading">
                <p className="eyebrow">Priority sequence</p>
                <h3 id="completion-title">Task completion order</h3>
              </div>
              {completionSections.map((section) => {
                const taskItems = section.items.filter((item) => item.type === 'task')
                if (taskItems.length === 0) return null
                return (
                  <section className="completion-section" key={section.label}>
                    <h4>{section.label}</h4>
                    <ol>
                      {section.items.map((item) => {
                        if (item.type === 'separator') {
                          return <li className="completion-band-separator" key={item.key} aria-label={`Priority band ${item.band}`} />
                        }
                        const task = item.task
                        return (
                          <li className="completion-task" key={item.key}>
                            <button type="button" onClick={() => editTask(task)}>
                              <span className="completion-dot" style={{ backgroundColor: task.color || '#78d5ff' }} />
                              <span>{task.title}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ol>
                  </section>
                )
              })}
              {tasks.length === 0 && <p className="completion-empty">Add a task to build your completion order.</p>}
        </aside>
        </div>

        <section className="about-strip" id="about">
          <p className="eyebrow">The Proteros method</p>
          <h2>Urgency is a signal, not a strategy.</h2>
          <p>Use the matrix to protect deep work, schedule important plans, and make room for the work that moves you forward.</p>
        </section>
      </main>

      {captureModal && (
        <div
          className="capture-modal"
          style={{ left: captureModal.left, top: captureModal.top }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-form-title"
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Task capture</p>
              <h2 id="task-form-title">{editingId ? 'Edit task' : 'Add a task'}</h2>
            </div>
            <button className="modal-close" type="button" onClick={resetForm} aria-label="Close task capture">×</button>
          </div>
          <form onSubmit={submitTask}>
            <label>
              Title
              <input name="title" value={form.title} onChange={updateField} placeholder="What needs your attention?" maxLength="120" autoFocus />
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
                <input name="dueDate" type="datetime-local" value={form.dueDate} onChange={updateField} />
              </label>
              <label>Color
                <input className="color-input" name="color" type="color" value={form.color} onChange={updateField} />
              </label>
            </div>
            <p className="coordinate-readout">Coordinates: X {form.x} / Y {form.y}</p>
            <div className="form-actions">
              <button className="primary-button" type="submit">{editingId ? 'Update task' : 'Add task'}</button>
              <button className="secondary-button" type="button" onClick={resetForm}>Cancel</button>
              {editingId && (
                <button className="delete-button" type="button" onClick={() => deleteTask(editingId)}>Delete</button>
              )}
            </div>
            {message && <p className="form-message" role="status">{message}</p>}
          </form>
        </div>
      )}

      <footer>PROTEROS </footer>
    </div>
  )
}

export default App
