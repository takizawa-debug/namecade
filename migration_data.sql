INSERT INTO customers (
    name, company, role, department, email, phone, phone_mobile, fax,
    address, postal_code, prefecture, city, address_line1, address_line2,
    website, sns_x, sns_facebook, sns_instagram, sns_linkedin, sns_other, gathered_links,
    tags, memo, image_url, ai_analysis, exchanger, business_category
) VALUES 
(
    '山田 太郎', '株式会社テックイノベーション', '代表取締役', '経営企画室', 'taro.yamada@tech-innovation.jp', '03-1234-5678', '090-1234-5678', '03-1234-5679',
    '東京都渋谷区渋谷1-2-3 テックビル5F', '150-0002', '東京都', '渋谷区', '渋谷1-2-3', 'テックビル5F',
    'https://tech-innovation.jp', 'https://x.com/tech_taro', 'https://facebook.com/taro.yamada', '', 'https://linkedin.com/in/taroyamada', '', '- https://tech-innovation.jp\n- https://x.com/tech_taro',
    'IT, 経営者', '先日のカンファレンスで名刺交換。', 'スキャン 2026_03_09 11:49:23.pdf', 'IT業界でのイノベーション推進に強みを持つ企業の代表。新規プロジェクトの技術支援などで協業の可能性があります。', '滝沢 裕樹', 'IT・通信'
),
(
    '佐藤 花子', '株式会社グローバルデザイン', 'チーフデザイナー', 'クリエイティブ部', 'hanako.sato@global-design.co.jp', '06-9876-5432', '080-9876-5432', '06-9876-5433',
    '大阪府大阪市北区梅田2-3-4 グローバルタワー10F', '530-0001', '大阪府', '大阪市北区', '梅田2-3-4', 'グローバルタワー10F',
    'https://global-design.co.jp', '', '', 'https://instagram.com/hanako_design', '', '', '- https://global-design.co.jp\n- https://note.com/hanako_sato',
    'デザイン, クリエイティブ', 'Webリニューアルの件で相談可能。', 'スキャン 2026_03_09 12:59:48.pdf', '国内外のデザイン賞の受賞歴がある企業のチーフデザイナー。ブランディングからUI/UXまで幅広い専門性があります。デザイン関連の案件でのパートナー候補として有力です。', '滝沢 裕樹', 'デザイン・広告'
),
(
    '鈴木 一郎', '有限会社エコフードシステム', '営業部長', '営業部', 'ichiro.suzuki@eco-food.co.jp', '052-111-2222', '070-1111-2222', '052-111-2223',
    '愛知県名古屋市中区栄3-4-5 エコビル2F', '460-0008', '愛知県', '名古屋市中区', '栄3-4-5', 'エコビル2F',
    'https://eco-food.co.jp', '', 'https://facebook.com/ichiro.suzuki.eco', '', '', '', '- https://eco-food.co.jp',
    '食品, 営業', '新しい食品卸のルートについて情報交換。', 'スキャン 2026_03_09 13:00:30.pdf', '環境に配慮した食品の企画・卸売を行う企業。SDGs関連の取り組みにおいて協業の接点が持てそうです。', '滝沢 裕樹', '食品・卸売'
),
(
    '田中 誠', '株式会社フューチャーシステムズ', 'シニアエンジニア', 'システム開発部', 'makoto.tanaka@futuresystems.co.jp', '092-222-3333', '090-2222-3333', '',
    '福岡県福岡市博多区博多駅前4-5-6 フューチャービル3F', '812-0011', '福岡県', '福岡市博多区', '博多駅前4-5-6', 'フューチャービル3F',
    'https://futuresystems.co.jp', 'https://x.com/makoto_sys', '', '', 'https://linkedin.com/in/makototanaka', 'https://github.com/makoto-sys', '- https://futuresystems.co.jp\n- https://github.com/makoto-sys',
    '開発, エンジニア', 'システム開発の委託先として検討。', 'スキャン 2026_03_09 13:01:31.pdf', 'AI・IoTなどの先端技術を用いたシステム開発を得意とするシニアエンジニア。複雑な技術課題の解決において強力なパートナーになる可能性があります。', '滝沢 裕樹', 'IT・システム開発'
),
(
    '伊藤 美咲', 'オーガニックコスメ株式会社', 'マーケティングマネージャー', 'マーケティング本部', 'misaki.ito@organic-cosme.co.jp', '011-333-4444', '', '011-333-4445',
    '北海道札幌市中央区大通西5-6-7 オーガニックビル1F', '060-0042', '北海道', '札幌市中央区', '大通西5-6-7', 'オーガニックビル1F',
    'https://organic-cosme.co.jp', '', '', 'https://instagram.com/misaki_organic', '', 'https://tiktok.com/@misaki_organic', '- https://organic-cosme.co.jp\n- https://instagram.com/organic_cosme_official',
    'コスメ, マーケティング', 'SNSマーケティングの事例共有。', 'スキャン 2026_03_09 13:02:04.pdf', '若年層向けのオーガニックコスメを展開する企業のマーケティング担当。SNSを活用した新しいプロモーション施策の提案が響く可能性があります。', '滝沢 裕樹', '化粧品・美容'
),
(
    '渡辺 健太', '株式会社スマートホーム', '建築士', '設計部', 'kenta.watanabe@smarthome.jp', '022-444-5555', '080-4444-5555', '022-444-5556',
    '宮城県仙台市青葉区本町6-7-8 スマートビル4F', '980-0014', '宮城県', '仙台市青葉区', '本町6-7-8', 'スマートビル4F',
    'https://smarthome.jp', '', 'https://facebook.com/kenta.watanabe', 'https://instagram.com/kenta_arch', '', '', '- https://smarthome.jp',
    '建築, 住宅', '住宅展示場で名刺交換。', 'スキャン 2026_03_09 13:02:39.pdf', 'IoTを活用したスマートホームの設計・施工を行う企業の建築士。住宅向けの新しいテクノロジーやサービスの導入に関する提案が有効です。', '滝沢 裕樹', '建築・不動産'
),
(
    '中村 結衣', 'エデュケーションプラス株式会社', '広報・PRチーフ', '広報部', 'yui.nakamura@edu-plus.co.jp', '082-555-6666', '090-5555-6666', '',
    '広島県広島市中区八丁堀7-8-9 エデュケーションビル8F', '730-0013', '広島県', '広島市中区', '八丁堀7-8-9', 'エデュケーションビル8F',
    'https://edu-plus.co.jp', 'https://x.com/yui_edupr', '', '', '', '', '- https://edu-plus.co.jp\n- https://prtimes.jp/main/html/searchrlp/company_id/12345',
    '教育, 広報', '来月のPRイベントへの協賛について検討。', 'スキャン 2026_03_09 13:03:01.pdf', 'EdTech関連のサービスを展開する企業の広報チーフ。教育機関向けのメディア等でのアライアンス・共同プロモーションの提案が刺さりそうです。', '滝沢 裕樹', '教育・学習支援'
),
(
    '小林 大輔', '株式会社グローバルロジスティクス', '物流コンサルタント', 'コンサルティング本部', 'daisuke.kobayashi@global-logi.com', '03-6666-7777', '070-6666-7777', '03-6666-7778',
    '東京都港区六本木8-9-10 ロジスティクスタワー20F', '106-0032', '東京都', '港区', '六本木8-9-10', 'ロジスティクスタワー20F',
    'https://global-logi.com', '', '', '', 'https://linkedin.com/in/daisukekobayashi-logi', '', '- https://global-logi.com\n- https://logi-biz.com/article/12345',
    '物流, コンサル', 'サプライチェーン最適化について相談。', 'スキャン 2026_03_09 13:03:23.pdf', '国際的な物流システム構築のコンサルティングを行うエキスパート。物流DXや効率化システムなどの提案や共同開発が考えられます。', '滝沢 裕樹', '運輸・物流'
),
(
    '加藤 優子', 'メディカルサポートセンター株式会社', '営業アシスタント', '営業第一部', 'yuko.kato@medical-support.co.jp', '045-777-8888', '090-7777-8888', '045-777-8889',
    '神奈川県横浜市西区みなとみらい9-10-11 メディカルビル6F', '220-0012', '神奈川県', '横浜市西区', 'みなとみらい9-10-11', 'メディカルビル6F',
    'https://medical-support.co.jp', '', '', '', '', '', '- https://medical-support.co.jp',
    '医療, 営業サポート', '展示会でのブース対応にて。', 'スキャン 2026_03_09 13:04:07.pdf', '医療機関向けのシステムや機材を提供する企業。営業ツールの効率化や、医療業界向けの新規サービスの展開チャネルとして期待できます。', '滝沢 裕樹', '医療・福祉'
),
(
    '吉田 健太', '株式会社アクティブスポーツ', '店舗マネージャー', 'リテール事業部', 'kenta.yoshida@active-sports.jp', '098-888-9999', '080-8888-9999', '',
    '沖縄県那覇市松山10-11-12 アクティブプラザ1F', '900-0032', '沖縄県', '那覇市', '松山10-11-12', 'アクティブプラザ1F',
    'https://active-sports.jp', 'https://x.com/active_naha', 'https://facebook.com/activesports.naha', 'https://instagram.com/active_sports_naha', '', '', '- https://active-sports.jp\n- https://x.com/active_naha',
    'スポーツ, 小売', '店舗向け決済システムの提案。', 'スキャン 2026_03_09 13:06:58.pdf', '沖縄県内で展開するスポーツ用品店のマネージャー。店舗のDX化、インバウンド対応システムなどの導入提案が課題解決に繋がる可能性があります。', '滝沢 裕樹', '小売・流通'
);
