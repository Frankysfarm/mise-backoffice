'use client';

import * as React from 'react';
import { useEditor, EditorContent as EditorContentOrig, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Heading2, Heading3, Link as LinkIcon, Strikethrough, Undo, Redo, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';

// TipTap ist mit React 19 types kompiliert, Backoffice nutzt React 18 types.
// Wir casten die Komponente, damit JSX sie als gültigen Elementtyp akzeptiert.
const EditorContent = EditorContentOrig as unknown as (props: { editor: Editor | null }) => React.ReactElement | null;

export function Wysiwyg({
  value, onChange, placeholder, minHeight = 180, className,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: 'text-matcha-700 underline' } }),
      Placeholder.configure({ placeholder: placeholder ?? 'Schreib los…' }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none rounded-b-md border border-t-0 bg-background px-4 py-3 focus:outline-none',
          'prose-headings:font-display prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5',
        ),
        style: `min-height: ${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;
  return (
    <div className={cn('rounded-md', className)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean, onClick: () => void, icon: React.ReactNode, title: string) => (
    <button type="button" onClick={onClick} title={title}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded transition',
        active ? 'bg-matcha-700 text-white' : 'hover:bg-muted',
      )}>
      {icon}
    </button>
  );

  function addLink() {
    const url = prompt('URL eintragen (leer lassen zum Entfernen):', editor.getAttributes('link').href ?? '');
    if (url === null) return;
    if (url === '') return editor.chain().focus().unsetLink().run();
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  return (
    <div className="flex flex-wrap gap-1 rounded-t-md border bg-muted/40 p-1">
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 className="h-4 w-4" />, 'H2')}
      {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), <Heading3 className="h-4 w-4" />, 'H3')}
      <div className="mx-1 w-px bg-border" />
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold className="h-4 w-4" />, 'Fett')}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic className="h-4 w-4" />, 'Kursiv')}
      {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), <Strikethrough className="h-4 w-4" />, 'Durchgestrichen')}
      <div className="mx-1 w-px bg-border" />
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List className="h-4 w-4" />, 'Aufzählung')}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered className="h-4 w-4" />, 'Nummerierte Liste')}
      {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), <Quote className="h-4 w-4" />, 'Zitat')}
      <div className="mx-1 w-px bg-border" />
      {btn(editor.isActive('link'), addLink, <LinkIcon className="h-4 w-4" />, 'Link')}
      <div className="mx-1 w-px bg-border" />
      {btn(false, () => editor.chain().focus().undo().run(), <Undo className="h-4 w-4" />, 'Rückgängig')}
      {btn(false, () => editor.chain().focus().redo().run(), <Redo className="h-4 w-4" />, 'Wiederherstellen')}
    </div>
  );
}
