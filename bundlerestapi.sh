#!/bin/bash

rm lambdarestapi.zip
zip -r lambdarestapi.zip lambdarestapi.js delayprocessor.js node_modules/moment node_modules/uuid
