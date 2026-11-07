FROM php:8.3-apache-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv libcurl4-openssl-dev libsqlite3-dev supervisor && docker-php-ext-install curl pdo_sqlite && a2enmod rewrite && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 PYTHONUNBUFFERED=1 LUNGITUDE_SECURE_COOKIES=1 LUNGITUDE_GOOGLE_SIGNIN=0
RUN pip install --no-cache-dir torch==2.5.1+cpu torchvision==0.20.1+cpu --extra-index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir numpy pandas pillow scikit-learn opencv-python-headless fastapi uvicorn python-multipart 'google-auth>=2.35,<3' 'requests>=2.32,<3' 'PyJWT[crypto]>=2.9,<3' 'python-dotenv>=1,<2'
WORKDIR /var/www/html
COPY . .
RUN cat ml/skin/output_efficient/model.pt.part* > ml/skin/output_efficient/model.pt && chown -R www-data:www-data data && printf 'upload_max_filesize=8M\npost_max_size=40M\nmemory_limit=64M\nexpose_php=Off\n' > /usr/local/etc/php/conf.d/lungitude.ini
COPY deploy/render-apache.conf /etc/apache2/sites-available/000-default.conf
COPY deploy/render-supervisor.conf /etc/supervisor/conf.d/lungitude.conf
RUN printf 'Listen 10000\n' > /etc/apache2/ports.conf
EXPOSE 10000
CMD ["/bin/sh", "deploy/render-start.sh"]
