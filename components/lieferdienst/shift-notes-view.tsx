'use client'

import { useState } from 'react'
import { ShiftNote, StaffMember } from '@/lib/lieferdienst/staff'
import { 
  StickyNote, Plus, AlertTriangle, Clock, Trash2, User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

interface ShiftNotesViewProps {
  notes: ShiftNote[]
  currentStaff: StaffMember | null
  onAddNote: (message: string, important: boolean) => void
  onDeleteNote: (noteId: string) => void
}

export function ShiftNotesView({ notes, currentStaff, onAddNote, onDeleteNote }: ShiftNotesViewProps) {
  const [newNote, setNewNote] = useState('')
  const [isImportant, setIsImportant] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const handleSubmit = () => {
    if (newNote.trim()) {
      onAddNote(newNote.trim(), isImportant)
      setNewNote('')
      setIsImportant(false)
      setShowForm(false)
    }
  }

  const importantNotes = notes.filter(n => n.important)
  const regularNotes = notes.filter(n => !n.important)

  const formatTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    
    if (diffMins < 1) return 'Gerade eben'
    if (diffMins < 60) return `Vor ${diffMins} Min`
    if (diffHours < 24) return `Vor ${diffHours} Std`
    return date.toLocaleDateString('de-DE')
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-char">Schichtnotizen</h1>
          <p className="text-steel">{notes.length} Notizen</p>
        </div>
        <Button 
          onClick={() => setShowForm(!showForm)}
          className="gap-2 bg-saffron hover:bg-saffron-deep"
        >
          <Plus className="w-4 h-4" />
          Neue Notiz
        </Button>
      </div>

      {/* Add Note Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-char mb-3">Neue Notiz erstellen</h3>
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Nachricht für die nächste Schicht..."
            className="min-h-[100px] rounded-xl border-stone-200 mb-4"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch 
                checked={isImportant}
                onCheckedChange={setIsImportant}
              />
              <span className="text-sm font-medium text-stone-600">Als wichtig markieren</span>
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Abbrechen
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!newNote.trim()}
                className="bg-saffron hover:bg-saffron-deep"
              >
                Speichern
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Important Notes */}
      {importantNotes.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-char uppercase tracking-wider flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Wichtige Hinweise
          </h2>
          <div className="space-y-3">
            {importantNotes.map(note => (
              <div 
                key={note.id}
                className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 relative group"
              >
                <button
                  onClick={() => onDeleteNote(note.id)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-amber-100 text-amber-600 opacity-0 group-hover:opacity-100 hover:bg-amber-200 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <p className="text-amber-900 font-medium pr-10">{note.message}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-amber-700">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {note.staffName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(note.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regular Notes */}
      <div>
        <h2 className="text-sm font-semibold text-char uppercase tracking-wider flex items-center gap-2 mb-3">
          <StickyNote className="w-4 h-4 text-stone-500" />
          Notizen
        </h2>
        {regularNotes.length === 0 && importantNotes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
            <StickyNote className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 font-medium">Keine Notizen vorhanden</p>
            <p className="text-stone-400 text-sm">Erstelle eine Notiz für die nächste Schicht</p>
          </div>
        ) : (
          <div className="space-y-3">
            {regularNotes.map(note => (
              <div 
                key={note.id}
                className="bg-white border border-stone-200 rounded-xl p-4 relative group hover:border-stone-300 transition-colors"
              >
                <button
                  onClick={() => onDeleteNote(note.id)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-stone-100 text-stone-500 opacity-0 group-hover:opacity-100 hover:bg-stone-200 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <p className="text-char pr-10">{note.message}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-steel">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {note.staffName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(note.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
