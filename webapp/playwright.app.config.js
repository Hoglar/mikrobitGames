import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/app/browser',timeout:25000,fullyParallel:true,workers:2,use:{baseURL:'http://127.0.0.1:4176',headless:true,trace:'retain-on-failure'},outputDir:'build/app-browser-results',reporter:[['list']],webServer:[
 {command:`"${process.execPath}" verification/serve-app.js --dist --connected --port=4176`,url:'http://127.0.0.1:4176',reuseExistingServer:false},
 {command:`"${process.execPath}" verification/serve-app.js --dist --port=4175`,url:'http://127.0.0.1:4175',reuseExistingServer:false}
]});
