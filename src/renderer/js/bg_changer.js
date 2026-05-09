async function get_random_bg(){
    const bg_dirs = await window.simpmcAPI.getBgDirs();
    console.log('[Bg] 得到的背景图片目录：', bg_dirs);
    if(bg_dirs.length == 0){
        console.log('[Bg] 暂无可用的背景图片。')
        return 0;
    }
    const random_num = Math.floor(Math.random() * bg_dirs.length);
    console.log('[Bg] 这次抽到的是：', random_num);

    const result_dir = bg_dirs[random_num];
    console.log('[Bg] 对应的图片路径：', result_dir);
    return result_dir;
}

async function change_bg(){
    const raw_path = await get_random_bg();
    if (!raw_path) return;

    const bg_container = document.getElementById('main-container');
    const bg_mask = document.getElementById('bg-mask')
    
    let formattedPath = raw_path.replace(/\\/g, '/');

    const finalUrl = `file:///${encodeURI(formattedPath)}`.replace(/#/g, '%23'); 
    const bg_brightness = await window.simpmcAPI.getBgBrightness();

    console.log('[Bg] 最终生成的 URL:', finalUrl);

    try {
        console.log('[Bg] 计算的遮罩透明度：', parseFloat((1.0 - bg_brightness).toFixed(10)))
        bg_mask.style.backgroundColor = `rgba(30, 30, 30, ${parseFloat((1.0 - bg_brightness).toFixed(10))})`;
        apply_bg_blur();
        bg_container.style.backgroundImage = `url("${finalUrl}")`;
    } catch(error) {
        console.error('[Bg] 切换背景图片失败：', error);
    }
}

async function apply_bg_brightness() {
    const bg_mask = document.getElementById('bg-mask');
    const bg_brightness = await window.simpmcAPI.getBgBrightness();
    console.log('[Bg] 计算的遮罩透明度：', parseFloat((1.0 - bg_brightness).toFixed(10)));
    bg_mask.style.backgroundColor = `rgba(30, 30, 30, ${parseFloat((1.0 - bg_brightness).toFixed(10))})`;
}

async function hidden_bg() {
    const bg_container = document.getElementById('main-container');
    bg_container.style.backgroundImage = 'none';
}

async function apply_bg_blur() {
    const bg_mask = document.getElementById('bg-mask');
    const bg_blur = await window.simpmcAPI.getBgBlur();
    console.log('[Bg] 计算的遮罩透明度：', bg_blur ,'px。');
    bg_mask.style.backdropFilter = `blur(${bg_blur}px)`;

}