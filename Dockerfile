FROM node:latest

WORKDIR /usr/src/app/
RUN useradd --home-dir /usr/src/app -s /bin/false www && \
    chown -R www:www /usr/src/app && \
    apt-get update && \
    apt-get install -y libpoppler-glib-dev
USER www:www

COPY --chown=www:www ./package.json .
RUN script --return -qc "npm i" /dev/null
COPY --chown=www:www . .
RUN script --return -qc "npm i" /dev/null
EXPOSE 80 443
USER root
STOPSIGNAL SIGTERM
HEALTHCHECK --timeout=2s CMD curl -f https://localhost/
CMD ["bash", "./docker-entrypoint.sh"]
