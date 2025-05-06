/**
 * シンプルスライドショーアプリケーション
 * Google Formの回答データに基づいて、スライドショーの表示枚数を自動的に調整する
 */
const slideApp = {
    // 設定情報
    config: {
        apiUrl: '',
        thresholds: [],
        images: []
    },
    
    // 現在の状態
    state: {
        currentSlide: 0,
        totalValue: 0,
        isLoading: false,
        pollingInterval: null
    },
    
    // DOM要素への参照
    elements: {},
    
    /**
     * アプリケーションの初期化
     * F-11: API URLの保存・読み込み
     */
    init() {
        console.log('スライドアプリを初期化しています...');
        
        // DOM要素への参照を保存
        this.elements = {
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('error-message'),
            slideDisplay: document.getElementById('slide-display'),
            totalValueDisplay: document.getElementById('total-value-display'),
            currentSlide: document.getElementById('current-slide')
        };
        
        // APIのURLをローカルストレージから読み込む
        this.config.apiUrl = localStorage.getItem('slideAppApiUrl');
        
        if (!this.config.apiUrl) {
            this.showError('API URLが設定されていません。管理画面から設定してください。');
            return;
        }
        
        // 設定情報の読み込み
        this.loadConfig()
            .then(() => {
                // データの初回読み込み
                return this.fetchData();
            })
            .then(() => {
                // 定期的なデータ更新の開始 (F-04)
                this.startPolling();
            })
            .catch(error => {
                console.error('初期化エラー:', error);
                this.showError(`初期化に失敗しました: ${error.message}`);
            });
    },
    
    /**
     * F-10: 設定情報の取得
     * サーバーから閾値と画像情報を取得する
     */
    async loadConfig() {
        this.showLoading(true);
        try {
            const response = await fetch(`${this.config.apiUrl}?action=getConfig`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.success) {
                this.config.thresholds = data.thresholds || [];
                this.config.images = data.images || [];
                console.log('設定を読み込みました:', this.config);
            } else {
                throw new Error(data.message || '設定の読み込みに失敗しました');
            }
        } catch (error) {
            console.error('設定読み込みエラー:', error);
            throw error;
        } finally {
            this.showLoading(false);
        }
    },
    
    /**
     * F-04: データ自動更新 (データの取得)
     * サーバーから最新の合計値を取得する
     */
    async fetchData() {
        if (this.state.isLoading) return;
        
        this.showLoading(true);
        try {
            const response = await fetch(`${this.config.apiUrl}?action=getData`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.success) {
                this.state.totalValue = data.totalValue || 0;
                console.log('取得した合計値:', this.state.totalValue);
                
                // 合計値の表示を更新
                this.elements.totalValueDisplay.textContent = this.state.totalValue;
                
                // 現在のスライドを更新
                this.updateCurrentSlide();
            } else {
                throw new Error(data.message || 'データの取得に失敗しました');
            }
        } catch (error) {
            console.error('データ取得エラー:', error);
            this.showError(`データの取得に失敗しました: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    },
    
    /**
     * F-04: データ自動更新 (ポーリング)
     * 30秒ごとにデータを更新する
     */
    startPolling() {
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
        }
        
        this.state.pollingInterval = setInterval(() => {
            this.fetchData();
        }, 30000); // 30秒間隔
        
        console.log('30秒間隔でのデータ自動更新を開始しました');
    },
    
    /**
     * 合計値に基づいて表示するスライドを更新する
     */
    updateCurrentSlide() {
        // 合計値に基づいて表示すべきスライド番号を計算
        let newSlide = 0;
        for (let i = 0; i < this.config.thresholds.length; i++) {
            if (this.state.totalValue >= this.config.thresholds[i]) {
                newSlide = i + 1;
            } else {
                break;
            }
        }
        
        // スライド番号が変わった場合のみ更新
        if (newSlide !== this.state.currentSlide) {
            console.log(`スライドを更新: ${this.state.currentSlide} -> ${newSlide}`);
            this.state.currentSlide = newSlide;
            this.elements.slideDisplay.textContent = newSlide;
            
            // スライド画像の更新
            this.updateSlideImage();
        }
    },
    
    /**
     * F-07: 画像読み込み処理
     * 現在のスライド番号に対応する画像を表示する
     */
    updateSlideImage() {
        const slideIndex = this.state.currentSlide - 1;
        
        // スライドが0（表示なし）または設定が不十分な場合
        if (slideIndex < 0 || !this.config.images || this.config.images.length <= slideIndex) {
            this.elements.currentSlide.style.opacity = '0';
            this.elements.currentSlide.src = '';
            return;
        }
        
        const imageUrl = this.getImageUrl(this.config.images[slideIndex]);
        
        // 画像の読み込み開始前に透明にする (F-03: アニメーション)
        this.elements.currentSlide.style.opacity = '0';
        
        // 新しい画像を読み込む
        const img = new Image();
        img.onload = () => {
            // 画像の読み込みが完了したら表示
            this.elements.currentSlide.src = imageUrl;
            // フェードインアニメーション
            setTimeout(() => {
                this.elements.currentSlide.style.opacity = '1';
            }, 100);
        };
        img.onerror = () => {
            // 画像の読み込みに失敗した場合
            console.error('画像の読み込みに失敗しました:', imageUrl);
            this.elements.currentSlide.src = '';
            this.showError(`スライド${this.state.currentSlide}の画像読み込みに失敗しました`);
        };
        img.src = imageUrl;
    },
    
    /**
     * F-07: 画像URLの処理
     * 画像ID/URLから実際の表示用URLを生成する
     */
    getImageUrl(imageIdOrUrl) {
        if (!imageIdOrUrl) return '';
        
        // すでにURLの場合はそのまま返す
        if (imageIdOrUrl.startsWith('http://') || imageIdOrUrl.startsWith('https://')) {
            return imageIdOrUrl;
        }
        
        // Google DriveのファイルIDの場合、表示用URLを生成
        return `https://drive.google.com/uc?export=view&id=${imageIdOrUrl}`;
    },
    
    /**
     * F-05: ローディング表示
     */
    showLoading(show) {
        this.state.isLoading = show;
        this.elements.loading.classList.toggle('hidden', !show);
    },
    
    /**
     * F-06: エラー表示
     */
    showError(message) {
        console.error('エラー:', message);
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.classList.remove('hidden');
        
        // 5秒後にエラーメッセージを非表示にする
        setTimeout(() => {
            this.elements.errorMessage.classList.add('hidden');
        }, 5000);
    }
};

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    slideApp.init();
});
