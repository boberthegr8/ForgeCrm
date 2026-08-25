from pathlib import Path

path = Path('vertical-saas-operations-platform---an-integrated-crm-+-project-&-operations-management-platform/components/Layout.tsx')
text = path.read_text(encoding='utf-8')
old = '<SuiteLink label="Quote / AI Quoter" comingSoon />'
new = '<SuiteLink label="Quote / AI Quoter" href="https://lumber-estimator-ai.vercel.app" />'
if new in text:
    print('CRM already links live Quoter.')
elif old not in text:
    raise SystemExit('Could not find CRM coming-soon Quoter nav item.')
else:
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print('CRM now links live Forge Quoter.')
