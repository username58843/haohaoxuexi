import React, { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { Placeholder } from '@tiptap/extensions'

/**
 * Rich-text note editor (TipTap/ProseMirror — the same engine Notesnook
 * uses). Content is exchanged as TipTap JSON and only ever rendered through
 * the editor, never as raw HTML. Loaded via next/dynamic (ssr: false).
 */

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }

function ToolbarButton({ active, disabled, onClick, title, children }) {
  return (
    <button
      type="button"
      className={`note-editor__tool${active ? ' is-active' : ''}`}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  )
}

export default function Editor({ noteId, content, editable = true, placeholder, onChange }) {
  const loadedFor = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Placeholder.configure({ placeholder: placeholder || 'Write something…' }),
    ],
    content: content || EMPTY_DOC,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      if (loadedFor.current === noteId) onChange?.(e.getJSON())
    },
  })

  // Swap content when the active note changes (without emitting onChange).
  useEffect(() => {
    if (!editor) return
    if (loadedFor.current === noteId) return
    loadedFor.current = noteId
    editor.commands.setContent(content || EMPTY_DOC, { emitUpdate: false })
  }, [editor, noteId, content])

  useEffect(() => {
    if (editor) editor.setEditable(editable)
  }, [editor, editable])

  if (!editor) return null

  const setLink = () => {
    const prev = editor.getAttributes('link').href || ''
    const url = window.prompt('URL', prev)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().unsetLink().run()
      return
    }
    if (!/^https?:\/\//i.test(url)) return
    editor.chain().focus().setLink({ href: url }).run()
  }

  return (
    <div className="note-editor">
      {editable && (
        <div className="note-editor__toolbar" role="toolbar">
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold (Ctrl+B)"
          >
            <b>B</b>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic (Ctrl+I)"
          >
            <i>I</i>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <s>S</s>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('highlight')}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            title="Highlight"
          >
            <mark>H</mark>
          </ToolbarButton>
          <span className="note-editor__sep" />
          {[1, 2, 3].map((level) => (
            <ToolbarButton
              key={level}
              active={editor.isActive('heading', { level })}
              onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
              title={`Heading ${level}`}
            >
              H{level}
            </ToolbarButton>
          ))}
          <span className="note-editor__sep" />
          <ToolbarButton
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            ••
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
          >
            1.
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('taskList')}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            title="Checklist"
          >
            ☑
          </ToolbarButton>
          <span className="note-editor__sep" />
          <ToolbarButton
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Quote"
          >
            ❝
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code block"
          >
            {'</>'}
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('link')} onClick={setLink} title="Link">
            🔗
          </ToolbarButton>
          <span className="note-editor__sep" />
          <ToolbarButton
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
            title="Undo (Ctrl+Z)"
          >
            ↺
          </ToolbarButton>
          <ToolbarButton
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
            title="Redo"
          >
            ↻
          </ToolbarButton>
        </div>
      )}
      <EditorContent editor={editor} className="note-editor__content" />
    </div>
  )
}
