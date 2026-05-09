async function update_bg_setting_shown(){
    const bg_enabled = await window.simpmcAPI.getBgSetting();
    const bg_brightness = await window.simpmcAPI.getBgBrightness();
    const bg_blur = await window.simpmcAPI.getBgBlur();
    const bgStyleSettings = document.getElementById('bg-mask-settings');
    const bgBrightnessShown = document.getElementById('brightness-shown');
    const bgBrightnessSlider = document.getElementById('brightness-slider');
    const bgBlurSlider = document.getElementById('blur-slider')
    const bgBlurShown = document.getElementById('blur-shown');

    if(bg_enabled.enabled){
        bgBrightnessShown.innerText = bg_brightness;
        bgStyleSettings.style.display = 'block';
        bgBrightnessSlider.value = bg_brightness;
        bgBlurShown.innerText = bg_blur + 'px';
        bgBlurSlider.value = bg_blur;
        
    } else {
        bgStyleSettings.style.display = 'none';
    }
}

async function setBgBrightness(brightness) {
    window.simpmcAPI.setBgBrightness(brightness);
    update_bg_setting_shown();
    apply_bg_brightness();
    showSaveStatus('设置已保存');
}

async function setBgBlur(blur) {
    window.simpmcAPI.setBgBlur(blur);
    update_bg_setting_shown();
    apply_bg_blur();
    showSaveStatus('设置已保存');
}