"use strict";
const LIFF_ID = window.LIFF_APP_ID || 'REPLACE_WITH_ENV';
async function init() {
    const liff = window.liff;
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn())
        liff.login();
    document.getElementById('submit').addEventListener('click', async () => {
        const name = document.getElementById('name').value;
        await liff.sendMessages([{ type: 'text', text: `Form submitted: ${name}` }]);
        document.getElementById('status').textContent = 'ส่งข้อมูลสำเร็จ ✅';
        liff.closeWindow();
    });
}
init();
