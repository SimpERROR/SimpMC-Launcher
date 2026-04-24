const CAROUSEL_ASSET_URL = 'https://raw.githubusercontent.com/SimpERROR/SimpMC-Launcher/refs/heads/main/SimpMC_Assets/carousel.json';
let carouselData = [];
let currentSlide = 0;
let autoPlayInterval = null;

async function loadCarousel() {
    console.log('开始加载轮播图...');
    
    const container = document.getElementById('carousel-container');
    const loading = document.getElementById('carousel-loading');

    try {
        console.log('请求地址:', CAROUSEL_ASSET_URL);
        const response = await fetch(CAROUSEL_ASSET_URL + '?t=' + Date.now());
        console.log('响应状态:', response.status);
        
        if (!response.ok) throw new Error('Network response was not ok');
        
        carouselData = await response.json();
        console.log('获取到轮播数据:', carouselData);

        if (loading) loading.style.display = 'none';

        if (carouselData.banners && carouselData.banners.length > 0) {
            renderCarousel();
            startAutoPlay();
        } else {
            console.log('没有轮播图数据');
        }
    } catch (error) {
        console.error('加载轮播图失败:', error);
        if (loading) {
            loading.textContent = '加载失败';
            loading.className = 'carousel-error';
        }
    }
}

function renderCarousel() {
    console.log('渲染轮播图...');
    
    const track = document.getElementById('carousel-track');
    const dots = document.getElementById('carousel-dots');

    track.innerHTML = carouselData.banners.map((banner, index) => {
        const hasLink = banner.link && banner.link.trim() !== '';
        const slideClass = hasLink ? 'carousel-slide' : 'carousel-slide no-link';
        const clickHandler = hasLink ? `onclick="window.open('${banner.link}', '_blank')"` : '';
        
        return `
            <div class="${slideClass}" ${clickHandler}>
                <div class="carousel-image">
                    <img src="${banner.image_url}" alt="${banner.title || ''}" loading="lazy">
                </div>
                <div class="carousel-content">
                    <div class="carousel-title">${banner.title || ''}</div>
                    <div class="carousel-desc">${banner.desc || ''}</div>
                </div>
            </div>
        `;
    }).join('');

    dots.innerHTML = carouselData.banners.map((_, index) => `
        <div class="carousel-dot ${index === 0 ? 'active' : ''}" onclick="goToSlide(${index})"></div>
    `).join('');

    currentSlide = 0;
    updateCarousel();
}

function updateCarousel() {
    const track = document.getElementById('carousel-track');
    const dots = document.querySelectorAll('.carousel-dot');

    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
    });
}

function goToSlide(index) {
    currentSlide = index;
    updateCarousel();
    resetAutoPlay();
}

function carouselPrev() {
    currentSlide = (currentSlide - 1 + carouselData.banners.length) % carouselData.banners.length;
    updateCarousel();
    resetAutoPlay();
}

function carouselNext() {
    currentSlide = (currentSlide + 1) % carouselData.banners.length;
    updateCarousel();
    resetAutoPlay();
}

function startAutoPlay() {
    stopAutoPlay();
    autoPlayInterval = setInterval(carouselNext, 5000);
}

function stopAutoPlay() {
    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
    }
}

function resetAutoPlay() {
    stopAutoPlay();
    startAutoPlay();
}

const container = document.getElementById('carousel-container');
if (container) {
    container.addEventListener('mouseenter', stopAutoPlay);
    container.addEventListener('mouseleave', startAutoPlay);
}