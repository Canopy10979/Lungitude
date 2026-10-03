@echo off
cd /d "%~dp0"
php -d upload_max_filesize=8M -d post_max_size=40M -S 127.0.0.1:8000 router.php
