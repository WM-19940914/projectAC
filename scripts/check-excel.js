const XLSX = require('xlsx');
// CLI 인자 또는 기본 경로에서 엑셀 파일 로드
const excelPath = process.argv[2] || './imports/price-list.xlsx';
const wb = XLSX.readFile(excelPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

// 분류 비어있는 행 찾기
const empty = data.filter(r => !r['분류']);
console.log('분류 비어있는 행:', empty.length, '건');
if (empty.length > 0) empty.forEach(r => console.log(' -', r['상품명']));

// 분류별 개수
const cats = {};
data.forEach(r => { const c = r['분류'] || '(없음)'; cats[c] = (cats[c]||0)+1; });
console.log('');
console.log('=== 분류별 개수 ===');
Object.entries(cats).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(k + ': ' + v));
