"""Human-readable report and two SVG curves from measured, comparable runs."""
from collections import Counter
import html
import json
from pathlib import Path


def report_text(report):
    lines=['# Testresultat','',f"Tid: {report['timestamp']}",f"Kode: `{report.get('code_commit') or 'ukjent'}`",
           f"Modus: {report['mode']} · Python: {report.get('python','ukjent')}",
           f"Endret arbeidsmappe: {report.get('working_tree_dirty')}", '']
    for title,key in (('Kontrollverktøy','tool_tests'),('Enhetstester','product_tests'),('Integrasjon og benchmark','integration_tests')):
        lines.append(f"- {title}: {dict(Counter(r['status'] for r in report.get(key,[])))}")
    lines.extend(['','## FoM',''])
    if report.get('fom'):
        lines.extend([f"Krav: **{report['fom']['requirements_percent']:.2f} %** · Modell: **{report['fom']['model_percent']:.2f} %**",
                      'Kurver: [krav](requirements.svg) · [modell](model.svg)'])
    else:lines.append('**Ikke komplett målbart ennå. Ingen FoM-punkt eller oppdiktet baseline.**')
    for reason in report.get('blockers',[]):lines.append('- '+reason)
    if report.get('setup_error'):lines.append('- '+report['setup_error'])
    lines.extend(['','## Kontrollgrupper','','| Gruppe | Status |','| --- | --- |'])
    for id,status in report.get('controls',{}).items():lines.append(f'| {id} | {status} |')
    lines.extend(['','## Feil og kontroller som ikke ble utført','','| Kontroll | Status | Årsak |','| --- | --- | --- |'])
    all_rows=report.get('tool_tests',[])+report.get('product_tests',[])+report.get('integration_tests',[])
    all_rows += [dict(id=id,**row) for id,row in report.get('models',{}).items()]
    for row in all_rows:
        if row['status']=='PASS':continue
        detail=row.get('detail') or row.get('output','').strip().split('\n')[-1]
        lines.append(f"| {row['id']} | {row['status']} | {str(detail).replace('|','/').replace(chr(10),' ')} |")
    metrics=report.get('measurements',{})
    if metrics:
        lines.extend(['','## Benchmark',''])
        for phase,data in metrics.get('http_db',{}).items():
            lines.extend([f'### {phase}','','| Operasjon | Antall | Feil | HTTP p95 ms | DB p95 ms |','| --- | --- | --- | --- | --- |'])
            for op,row in data['summary'].items():
                lines.append(f"| {op} | {row['count']} | {row['errors']} | {row['http_p95_ms']} | {row['db_p95_ms']} |")
        if 'ai' in metrics:
            lines.extend(['','| AI-fase | Sekunder | Format/status gyldig |','| --- | --- | --- |'])
            for row in metrics['ai']:lines.append(f"| {row['phase']} | {row['seconds']:.3f} | {row['valid']} |")
            lines.append('\nAI-format og tidsgrense beviser ikke alle faktapåstander. Svarene ligger i rårapporten.')
    lines.extend(['','Alle delresultater, måleverdier og miljøopplysninger ligger i `report.json`.',''])
    return '\n'.join(lines)


def series_key(report):
    # Model/hardware/control changes must not silently join an earlier curve.
    environment={k:v for k,v in report.get('environment',{}).items() if k!='fixture_clock'}
    return (report.get('control_digest'),json.dumps(environment,sort_keys=True,default=str),report.get('machine'))


def write_curves(folder, runs, current):
    if not current.get('fom'):return
    candidates=[]
    for path in sorted(runs.glob('*/report.json')):
        try:report=json.loads(path.read_text())
        except (OSError,ValueError):continue
        # fixture_clock is provenance, not a performance environment change.
        if report.get('fom') and series_key(report)==series_key(current):candidates.append(report)
    for metric,filename,title in (('requirements_percent','requirements.svg','Krav-FoM'),('model_percent','model.svg','Modell-FoM')):
        dots=[];points=[]
        for index,report in enumerate(candidates):
            x=70+index*600/max(1,len(candidates)-1);y=290-report['fom'][metric]*2.3
            points.append(f'{x:.1f},{y:.1f}')
            dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="#2563eb"><title>{html.escape(report["timestamp"])}: {report["fom"][metric]:.2f}%</title></circle>')
            dots.append(f'<text x="{x:.1f}" y="315" text-anchor="middle" font-size="12">{index+1}</text>')
        svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="740" height="360" viewBox="0 0 740 360">
<rect width="740" height="360" fill="white"/><text x="70" y="30" font-size="22">{title}</text>
<path d="M70 60V290H690" fill="none" stroke="#64748b"/><text x="20" y="65">100%</text><text x="35" y="290">0%</text>
<polyline points="{' '.join(points)}" fill="none" stroke="#2563eb" stroke-width="2"/>{''.join(dots)}
<text x="70" y="345" font-size="13">Målepunkt 1 er baseline. Bare samme kontrollgrunnlag og miljø vises.</text></svg>'''
        (folder/filename).write_text(svg)
