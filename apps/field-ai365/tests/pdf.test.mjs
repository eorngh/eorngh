import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bundledPdfLib} from '../tools/pdf-lib-node.mjs';
import {buildPdfFromJpegs} from '../public/reports.mjs';
test('실제 번들 PDF 라이브러리로 2페이지 A4 조립 후 재파싱',async()=>{const lib=await bundledPdfLib();const jpeg=new Uint8Array(await readFile(new URL('./fixtures/pdf-page.jpg',import.meta.url)));const bytes=await buildPdfFromJpegs(lib,[jpeg,jpeg]);assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');const pdf=await lib.PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),2);for(const page of pdf.getPages()){assert.equal(page.getWidth(),595.28);assert.equal(page.getHeight(),841.89);}assert.equal(pdf.getCreator(),'현장AI365');});
