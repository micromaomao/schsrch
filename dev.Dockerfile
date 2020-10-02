FROM node:lts

WORKDIR /usr/src/app/
RUN chown -R node:node /usr/src/app && \
    apt-get update && \
    apt-get install -y --no-install-recommends libpoppler-glib-dev ghostscript libcap2-bin && \
    rm -rf /var/lib/apt/lists/* && \
    setcap 'cap_net_bind_service=ep' /usr/local/bin/node
USER node:node

CMD ["bash"]
