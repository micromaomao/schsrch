FROM node:lts-stretch

WORKDIR /usr/src/app/
RUN useradd --home-dir /usr/src/app -s /bin/false www && \
    chown -R www:www /usr/src/app && \
    apt-get update && \
    apt-get install -y --no-install-recommends libpoppler-glib-dev ghostscript && \
    rm -rf /var/lib/apt/lists/*
USER www:www

COPY --chown=www:www ./package.json .
RUN npm i --progress=false --loglevel=warn 2>&1
COPY --chown=www:www . .
RUN npm i --progress=false --loglevel=warn 2>&1
EXPOSE 80 443
USER root
STOPSIGNAL SIGTERM
HEALTHCHECK --timeout=2s CMD curl -f https://localhost/
CMD ["bash", "./docker-entrypoint.sh"]
