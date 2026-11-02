import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTICLES, CATEGORIES, TOTAL, findArticle, groupedArticles, neighbours } from '../src/guide/index.js';

const LOCALES = ['vi', 'en', 'zh-CN'];
const ALLOWED_TYPES = new Set(['p', 'list', 'steps', 'note', 'table']);

test('guide registry: 18 unique articles, ordered, with valid metadata', () => {
  assert.equal(TOTAL, 18);
  assert.equal(ARTICLES.length, TOTAL);
  const slugs = ARTICLES.map(article => article.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'slugs must be unique');
  ARTICLES.forEach((article, index) => {
    assert.equal(article.number, index + 1, `${article.slug} has the wrong number`);
    assert.ok(CATEGORIES.includes(article.category), `${article.slug} has an unknown category`);
    assert.equal(typeof article.icon, 'string');
    assert.ok(article.icon.length > 0, `${article.slug} needs an icon`);
  });
  assert.equal(findArticle('micro').slug, 'micro');
  assert.equal(findArticle('nope'), null);
  // Grouping keeps the curated order inside each category but reorders categories for display.
  assert.deepEqual(
    groupedArticles().flatMap(group => group.items).map(item => item.slug).sort(),
    [...slugs].sort(),
  );
});

test('guide registry: neighbours walk the whole list and stop at both ends', () => {
  assert.equal(neighbours(ARTICLES[0].slug).previous, null);
  assert.equal(neighbours(ARTICLES.at(-1).slug).next, null);
  for (let index = 0; index < ARTICLES.length - 1; index += 1) {
    assert.equal(neighbours(ARTICLES[index].slug).next.slug, ARTICLES[index + 1].slug);
    assert.equal(neighbours(ARTICLES[index + 1].slug).previous.slug, ARTICLES[index].slug);
  }
  assert.deepEqual(neighbours('missing'), { previous: null, next: null });
});

test('guide content: every article is translated to all three interface languages', () => {
  for (const article of ARTICLES) {
    for (const locale of LOCALES) {
      const titles = article.titles[locale];
      assert.ok(titles, `${article.slug} is missing titles.${locale}`);
      assert.equal(typeof titles.title, 'string');
      assert.ok(titles.title.trim().length > 0, `${article.slug}.${locale} has an empty title`);
      assert.equal(typeof titles.summary, 'string');
      assert.ok(titles.summary.trim().length > 0, `${article.slug}.${locale} has an empty summary`);
      const blocks = article.blocks[locale];
      assert.ok(Array.isArray(blocks) && blocks.length > 0, `${article.slug}.${locale} has no blocks`);
    }
  }
});

test('guide content: no article is left as a placeholder stub', () => {
  const flatText = blocks => blocks.flatMap(block => [
    block.text || '', ...(block.items || []), ...(block.head || []), ...(block.rows || []).flat(),
  ]).join(' ');
  for (const article of ARTICLES) {
    for (const locale of LOCALES) {
      const titles = article.titles[locale];
      assert.notEqual(titles.title, article.slug, `${article.slug}.${locale} still has the stub title`);
      assert.ok(titles.summary.length >= 15, `${article.slug}.${locale} summary is too short`);
      assert.ok(article.blocks[locale].length >= 2, `${article.slug}.${locale} has too few blocks`);
      assert.ok(flatText(article.blocks[locale]).length >= 200, `${article.slug}.${locale} body is too short`);
    }
    assert.ok(!/Đang cập nhật/.test(flatText(article.blocks.vi)), `${article.slug} is still marked as updating`);
  }
});

test('guide content: the same block structure exists in every language', () => {
  for (const article of ARTICLES) {
    const reference = article.blocks.vi;
    for (const locale of LOCALES) {
      const blocks = article.blocks[locale];
      assert.equal(blocks.length, reference.length, `${article.slug}.${locale} has a different block count`);
      blocks.forEach((block, index) => {
        const base = reference[index];
        assert.ok(ALLOWED_TYPES.has(block.type), `${article.slug}.${locale} block ${index} has type ${block.type}`);
        assert.equal(block.type, base.type, `${article.slug}.${locale} block ${index} type differs from vi`);
        if (block.type === 'p' || block.type === 'note') {
          assert.equal(typeof block.text, 'string', `${article.slug}.${locale} block ${index} needs text`);
          assert.ok(block.text.trim().length > 0, `${article.slug}.${locale} block ${index} has empty text`);
          if (block.type === 'note') {
            assert.equal(block.tone, base.tone, `${article.slug}.${locale} block ${index} tone differs from vi`);
            assert.ok(['info', 'warning'].includes(block.tone));
          }
        }
        if (block.type === 'list' || block.type === 'steps') {
          assert.equal(block.items.length, base.items.length, `${article.slug}.${locale} block ${index} item count differs`);
          block.items.forEach(item => assert.ok(String(item).trim().length > 0, `${article.slug}.${locale} block ${index} has an empty item`));
        }
        if (block.type === 'table') {
          assert.equal(block.head.length, base.head.length, `${article.slug}.${locale} block ${index} column count differs`);
          assert.equal(block.rows.length, base.rows.length, `${article.slug}.${locale} block ${index} row count differs`);
          block.rows.forEach((row, rowIndex) => {
            assert.equal(row.length, base.rows[rowIndex].length, `${article.slug}.${locale} block ${index} row ${rowIndex} cell count differs`);
            row.forEach(cell => assert.ok(String(cell).trim().length > 0, `${article.slug}.${locale} block ${index} row ${rowIndex} has an empty cell`));
          });
        }
      });
    }
  }
});

test('guide content: en and zh-CN are real translations, not the Vietnamese text', () => {
  const flat = blocks => blocks.flatMap(block => [
    block.text || '', ...(block.items || []), ...(block.head || []), ...(block.rows || []).flat(),
  ]).filter(text => text.length >= 30);
  for (const article of ARTICLES) {
    const viChunks = new Set(flat(article.blocks.vi));
    for (const locale of ['en', 'zh-CN']) {
      const translated = flat(article.blocks[locale]);
      const copied = translated.filter(chunk => viChunks.has(chunk));
      assert.equal(copied.length, 0, `${article.slug}.${locale} copies ${copied.length} Vietnamese passages verbatim`);
    }
    // Chinese text must actually contain Chinese characters.
    const zhText = flat(article.blocks['zh-CN']).join(' ');
    assert.match(zhText, /[\u4e00-\u9fff]/, `${article.slug}.zh-CN does not contain Chinese characters`);
  }
});

test('guide content: inline markup is balanced in every language', () => {
  const strings = [];
  for (const article of ARTICLES) {
    strings.push(article.titles.vi.title, article.titles.en.title, article.titles['zh-CN'].title);
    for (const locale of LOCALES) {
      for (const block of article.blocks[locale]) {
        if (block.text) strings.push(block.text);
        if (block.items) strings.push(...block.items);
        if (block.head) strings.push(...block.head);
        if (block.rows) strings.push(...block.rows.flat());
      }
    }
  }
  for (const value of strings) {
    const text = String(value);
    assert.equal((text.match(/\*\*/g) || []).length % 2, 0, `unbalanced ** in: ${text.slice(0, 80)}`);
    assert.equal((text.match(/`/g) || []).length % 2, 0, `unbalanced backtick in: ${text.slice(0, 80)}`);
    const italics = (text.match(/(?<!\*)\*(?!\*)/g) || []).length;
    assert.equal(italics % 2, 0, `unbalanced * in: ${text.slice(0, 80)}`);
  }
});

test('guide content: renderer block types are all exercised by the corpus', () => {
  const seen = new Set();
  for (const article of ARTICLES) {
    for (const block of article.blocks.vi) seen.add(block.type);
  }
  assert.deepEqual([...seen].sort(), ['list', 'note', 'p', 'steps', 'table']);
});
