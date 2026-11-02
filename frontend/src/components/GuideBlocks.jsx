import {
  Activity,
  ArrowLeftRight,
  BookOpen,
  CircleHelp,
  House,
  Info,
  Languages,
  LayoutDashboard,
  Link2,
  MessagesSquare,
  Mic,
  Plus,
  QrCode,
  Rocket,
  TriangleAlert,
  UserCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { Fragment } from 'react';

// Icons are referenced by name from plain data files so the article modules stay
// renderer-free and can be unit tested with Node.
const ICONS = {
  Activity, ArrowLeftRight, BookOpen, House, Info, Languages, LayoutDashboard, Link2,
  MessagesSquare, Mic, Plus, QrCode, Rocket, TriangleAlert, UserCheck, UserRound, UsersRound,
};

export function ArticleIcon({ name, size = 22 }) {
  const Component = ICONS[name] || BookOpen;
  return <Component size={size} aria-hidden="true" />;
}

// Tiny inline markup: **bold**, *italic* and `code`. Kept deliberately small so
// translators only ever deal with plain sentences.
export function renderInline(text) {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  const parts = String(text).split(pattern);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function Block({ block }) {
  if (block.type === 'p') {
    // Articles use a bold-only paragraph as a section heading; give it real structure.
    if (/^\*\*[^*]+\*\*$/.test(block.text.trim())) {
      return <h3 className="guide-subhead">{block.text.trim().slice(2, -2)}</h3>;
    }
    return <p>{renderInline(block.text)}</p>;
  }
  if (block.type === 'list') {
    return <ul className="guide-list">{block.items.map((item, index) => <li key={index}>{renderInline(item)}</li>)}</ul>;
  }
  if (block.type === 'steps') {
    return <ol className="guide-steps">{block.items.map((item, index) => <li key={index}>{renderInline(item)}</li>)}</ol>;
  }
  if (block.type === 'note') {
    const Icon = block.tone === 'warning' ? CircleHelp : Info;
    return <p className={`guide-callout ${block.tone === 'warning' ? 'warning' : ''}`} role="note">
      <Icon size={17} aria-hidden="true" />
      <span>{renderInline(block.text)}</span>
    </p>;
  }
  if (block.type === 'table') {
    return <div className="guide-table-wrap">
      <table>
        <thead><tr>{block.head.map((cell, index) => <th key={index} scope="col">{renderInline(cell)}</th>)}</tr></thead>
        <tbody>
          {block.rows.map((row, rowIndex) => <tr key={rowIndex}>
            {row.map((cell, cellIndex) => cellIndex === 0
              ? <th key={cellIndex} scope="row">{renderInline(cell)}</th>
              : <td key={cellIndex}>{renderInline(cell)}</td>)}
          </tr>)}
        </tbody>
      </table>
    </div>;
  }
  return null;
}

export function GuideBlocks({ blocks }) {
  return <div className="guide-content">{blocks.map((block, index) => <Block key={index} block={block} />)}</div>;
}
